import { getAddress, type Address, type Hash, type Hex } from "viem";
import {
  decisionResponseSchema,
  grenVaultAbi,
  reasonCodeSchema,
  type ChainSnapshot,
  type DecisionPreviewRequest,
  type DecisionResponse,
  type RiskProfile,
} from "@gren/shared";

import type { AgentConfig } from "../config.js";
import {
  assertKeeperPermissions,
  explorerUrl,
  readVaultSnapshot,
  type ChainClients,
} from "../chain/client.js";
import { buildDecision } from "./engine.js";
import { reasonCodeFromHex, toContractDecision } from "./hash.js";
import { ModelAdapter, policyContext, selectPreviewProposal } from "./model.js";
import { Keeper } from "../keeper/keeper.js";
import type { DecisionStoreLike } from "../store/decisionStore.js";

const profiles = ["conservative", "balanced", "aggressive"] as const;

function snapshotMatches(expected: ChainSnapshot, provided: ChainSnapshot): boolean {
  return (
    expected.totalAssets === provided.totalAssets
    && expected.totalShares === provided.totalShares
    && expected.reserveBps === provided.reserveBps
    && expected.dexBps === provided.dexBps
    && expected.policyVersion === provided.policyVersion
    && expected.observedAt === provided.observedAt
  );
}

function policyReason(value: string): string {
  return reasonCodeSchema.safeParse(value).success ? value : "INPUT_STALE";
}

export class DecisionService {
  private readonly keeper: Keeper;
  private readonly model: ModelAdapter;
  private readonly executionLocks = new Map<string, Promise<DecisionResponse>>();

  public constructor(
    private readonly config: AgentConfig,
    private readonly clients: ChainClients,
    private readonly store: DecisionStoreLike,
    model?: ModelAdapter,
  ) {
    this.keeper = new Keeper(clients);
    this.model = model ?? ModelAdapter.fromConfig(config);
  }

  public async verifyKeeper(): Promise<void> {
    await assertKeeperPermissions(this.clients, this.config.vaults);
  }

  public async preview(request: DecisionPreviewRequest): Promise<DecisionResponse> {
    const vault = getAddress(request.vault) as Address;
    const vaultProfile = this.profileForVault(vault);
    const selectedProfile = request.profile ?? vaultProfile;
    const strategy = this.config.reserveStrategies[vaultProfile];
    const snapshotState = await readVaultSnapshot(
      this.clients,
      vault,
      strategy,
    );
    const snapshot: ChainSnapshot = {
      totalAssets: snapshotState.totalAssets.toString(),
      totalShares: snapshotState.totalShares.toString(),
      reserveBps: snapshotState.reserveBps,
      dexBps: snapshotState.dexBps,
      policyVersion: snapshotState.policyVersion.toString(),
      observedAt: snapshotState.observedAt,
    };
    const generated = await selectPreviewProposal(
      request,
      policyContext(selectedProfile, snapshot),
      this.model,
    );
    const decision = buildDecision(
      vault,
      this.config.usdtAddress,
      strategy,
      selectedProfile,
      snapshot,
      generated,
    );

    let accepted = false;
    let reason = "";
    if (request.snapshot && !snapshotMatches(snapshot, request.snapshot)) {
      reason = "INPUT_STALE";
    } else {
      const result = await this.clients.publicClient.readContract({
        address: vault,
        abi: grenVaultAbi,
        functionName: "validateDecision",
        args: [toContractDecision(decision)],
      } as never) as readonly [boolean, Hex];
      accepted = result[0];
      if (!accepted) reason = policyReason(reasonCodeFromHex(result[1]));
    }

    const response = decisionResponseSchema.parse({
      decisionId: decision.decisionId,
      vault: decision.vault,
      profile: selectedProfile,
      allocation: { reserveBps: decision.reserveBps, dexBps: decision.dexBps },
      reasonCode: decision.reasonCode,
      explanation: accepted
        ? generated.explanation
        : `Policy rejected this structured proposal: ${reason}`,
      inputHash: decision.inputHash,
      expiresAt: decision.expiresAt,
      policy: {
        status: accepted ? "accepted" : "rejected",
        reasons: accepted ? [] : [reason],
      },
      execution: {
        status: "not_submitted",
        transactionHash: null,
        explorerUrl: null,
      },
    });

    await this.store.put({ decision, response, createdAt: Date.now() });
    return response;
  }

  public async execute(decisionId: string): Promise<DecisionResponse> {
    const existing = this.executionLocks.get(decisionId);
    if (existing) return existing;

    const execution = this.executeOnce(decisionId);
    this.executionLocks.set(decisionId, execution);
    try {
      return await execution;
    } finally {
      if (this.executionLocks.get(decisionId) === execution) {
        this.executionLocks.delete(decisionId);
      }
    }
  }

  private async executeOnce(decisionId: string): Promise<DecisionResponse> {
    const record = await this.store.get(decisionId);
    if (!record) throw new Error("Decision not found");
    if (record.response.policy.status !== "accepted") {
      throw new Error("Only a policy-accepted decision can be submitted");
    }
    if (record.response.execution.status !== "not_submitted") {
      return this.status(decisionId);
    }
    if (record.decision.expiresAt <= Math.floor(Date.now() / 1_000)) {
      throw new Error("Decision has expired");
    }

    const transactionHash = await this.keeper.submit(record.decision);
    const updated = await this.store.update(decisionId, (current) => ({
      ...current,
      response: {
        ...current.response,
        execution: {
          status: "pending_confirmation",
          transactionHash,
          explorerUrl: explorerUrl(this.config, transactionHash),
        },
      },
    }));
    if (!updated) throw new Error("Decision disappeared from the store");
    return updated.response;
  }

  public async status(decisionId: string): Promise<DecisionResponse> {
    const record = await this.store.get(decisionId);
    if (!record) throw new Error("Decision not found");
    if (!record.response.execution.transactionHash) return record.response;

    const result = await this.keeper.status(
      record.response.execution.transactionHash as Hash,
      record.decision.vault as Address,
      record.decision.decisionId,
    );
    const updated = await this.store.update(decisionId, (current) => ({
      ...current,
      response: {
        ...current.response,
        execution: {
          ...current.response.execution,
          status: result.status,
        },
      },
    }));
    return updated?.response ?? record.response;
  }

  private profileForVault(vault: Address): RiskProfile {
    for (const profile of profiles) {
      if (this.config.vaults[profile].toLowerCase() === vault.toLowerCase()) return profile;
    }
    throw new Error("Vault is not configured for this deployment");
  }
}
