export const botChainTestnet = {
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrl: "https://rpc.bohr.life",
  explorerUrl: "https://scan.bohr.life",
  faucetUrl: "https://faucet.botchain.ai/basic",
  contracts: {
    usdt: "0x75edC9335175Fc0552D51D48439F229c10420fe3",
  },
  usdtDecimals: 6,
  bdexEnabled: false,
  deployedAtBlock: 20_439_347,
} as const;

export const botChain = botChainTestnet;

export const riskProfiles = ["conservative", "balanced", "aggressive"] as const;
export type RiskProfile = (typeof riskProfiles)[number];

export const profileIndexes: Record<RiskProfile, number> = {
  conservative: 0,
  balanced: 1,
  aggressive: 2,
};

export const profilePolicies: Record<
  RiskProfile,
  { maxDexBps: number; maxSlippageBps: number }
> = {
  conservative: { maxDexBps: 2_500, maxSlippageBps: 50 },
  balanced: { maxDexBps: 4_500, maxSlippageBps: 80 },
  aggressive: { maxDexBps: 7_000, maxSlippageBps: 120 },
};
