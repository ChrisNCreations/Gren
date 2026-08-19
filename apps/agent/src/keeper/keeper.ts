import { decodeEventLog, type Address, type Hash } from "viem";
import { grenVaultAbi, type ContractDecision, type ExecutionStatus } from "@gren/shared";

import { toContractDecision } from "../decisions/hash.js";
import type { ChainClients } from "../chain/client.js";

export class Keeper {
  public constructor(private readonly clients: ChainClients) {}

  public async submit(decision: ContractDecision): Promise<Hash> {
    return this.clients.walletClient.writeContract({
      account: this.clients.account,
      address: decision.vault,
      abi: grenVaultAbi,
      functionName: "executeDecision",
      args: [toContractDecision(decision)],
      chain: this.clients.chain,
    } as never);
  }

  public async status(
    transactionHash: Hash,
    expectedVault: Address,
    expectedDecisionId: string,
  ): Promise<{ status: ExecutionStatus; accepted: boolean }> {
    try {
      const receipt = await this.clients.publicClient.getTransactionReceipt({ hash: transactionHash });
      if (receipt.status === "reverted") return { status: "failed", accepted: false };
      if (!receipt.to || receipt.to.toLowerCase() !== expectedVault.toLowerCase()) {
        return { status: "failed", accepted: false };
      }

      let accepted = false;
      let rejected = false;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== expectedVault.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: grenVaultAbi,
            data: log.data,
            topics: log.topics,
          } as never) as { eventName?: string; args?: { decisionId?: string } };
          const decisionId = decoded.args?.decisionId;
          if (!decisionId || decisionId.toLowerCase() !== expectedDecisionId.toLowerCase()) continue;
          accepted ||= decoded.eventName === "DecisionAccepted";
          rejected ||= decoded.eventName === "DecisionRejected";
        } catch {
          // Ignore unrelated logs from the transaction.
        }
      }

      if (rejected) return { status: "rejected_by_policy", accepted: false };
      if (accepted) return { status: "confirmed", accepted: true };
      return { status: "failed", accepted: false };
    } catch (error) {
      if (String(error).includes("TransactionReceiptNotFound")) {
        return { status: "pending_confirmation", accepted: false };
      }
      throw error;
    }
  }
}
