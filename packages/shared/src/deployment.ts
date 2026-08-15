import { z } from "zod";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const deploymentArtifactSchema = z.object({
  network: z.literal("bot-chain-testnet"),
  chainId: z.literal(968),
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
  }),
  policy: z.object({
    cooldownSeconds: z.number().int().nonnegative(),
    maxInputAgeSeconds: z.number().int().positive(),
    bdexEnabled: z.literal(false),
  }),
  transactions: z.record(z.string(), z.string().regex(/^0x[a-fA-F0-9]{64}$/)),
  deployedAt: z.union([z.string(), z.number()]),
});

export type DeploymentArtifact = z.infer<typeof deploymentArtifactSchema>;
