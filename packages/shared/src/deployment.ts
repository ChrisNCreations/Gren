import { z } from "zod";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const deploymentArtifactSchema = z.object({
  network: z.enum(["bot-chain-testnet", "bot-chain-mainnet"]),
  chainId: z.union([z.literal(968), z.literal(677)]),
  rpcUrl: z.string().url(),
  explorerUrl: z.string().url(),
  usdt: z.object({ address: addressSchema, decimals: z.literal(6), symbol: z.literal("USDT") }),
  roles: z.object({
    owner: addressSchema,
    policyAdmin: addressSchema,
    pauser: addressSchema,
    keeper: addressSchema,
  }),
  vaults: z.object({
    conservative: addressSchema,
    balanced: addressSchema,
    aggressive: addressSchema,
  }),
  strategies: z.object({
    conservativeReserve: addressSchema,
    balancedReserve: addressSchema,
    aggressiveReserve: addressSchema,
    aggressiveBdex: addressSchema.optional(),
  }),
  policy: z.object({
    cooldownSeconds: z.number().int().nonnegative(),
    maxInputAgeSeconds: z.number().int().positive(),
    bdexEnabled: z.boolean(),
  }),
  vaultBdex: z.object({
    conservative: z.boolean(),
    balanced: z.boolean(),
    aggressive: z.boolean(),
  }).optional(),
  bdex: z.object({
    wbot: addressSchema,
    router: addressSchema,
    factory: addressSchema,
    pair: addressSchema,
    aggressiveStrategy: addressSchema,
    oracle: z.string().min(1),
  }).optional(),
  transactions: z.record(z.string(), z.string().regex(/^0x[a-fA-F0-9]{64}$/)),
  deployedAt: z.union([z.string(), z.number()]),
}).superRefine((value, context) => {
  if (value.network === "bot-chain-testnet" && value.chainId !== 968) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Testnet artifacts must use chain ID 968" });
  }
  if (value.network === "bot-chain-mainnet" && value.chainId !== 677) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Mainnet artifacts must use chain ID 677" });
  }
  if (value.network === "bot-chain-mainnet" && value.policy.bdexEnabled) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Mainnet artifacts must keep BDEX disabled" });
  }
  if (value.network === "bot-chain-testnet" && value.policy.bdexEnabled) {
    if (!value.bdex || !value.strategies.aggressiveBdex) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Testnet BDEX enablement requires recorded BDEX addresses and an aggressive adapter",
      });
    }
    if (value.vaultBdex && (value.vaultBdex.conservative || value.vaultBdex.balanced || !value.vaultBdex.aggressive)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phase 3 enables BDEX on the aggressive vault only",
      });
    }
  }
});

export type DeploymentArtifact = z.infer<typeof deploymentArtifactSchema>;
