export const botChainTestnet = {
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrl: "https://rpc.bohr.life",
  explorerUrl: "https://scan.bohr.life",
  faucetUrl: "https://faucet.botchain.ai/basic",
  contracts: {
    usdt: "0x75edC9335175Fc0552D51D48439F229c10420fe3",
    wbot: "0xD5452816194a3784dBa983426cCe7c122F4abd30",
    bdexRouter: "0xD6425a02f0845B8D99e349C34D2E7A576E177345",
    bdexFactory: "0x65b8e98ceA190d8c28B3e4716402027f634d15a3",
    bdexPair: "0xD3EC267707BA234583645E75CE283Cf679dd94Fa",
  },
  usdtDecimals: 6,
  bdexEnabled: true,
  bdexByProfile: {
    conservative: false,
    balanced: false,
    aggressive: true,
  },
  bdexOracle: "pair-reserves",
  deployedAtBlock: 21_325_462,
} as const;

export const botChainMainnet = {
  id: 677,
  name: "BOT Chain Mainnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrl: "https://rpc.botchain.ai",
  explorerUrl: "https://scan.botchain.ai",
  faucetUrl: "",
  contracts: {
    usdt: "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C",
  },
  usdtDecimals: 6,
  bdexEnabled: false,
  bdexByProfile: {
    conservative: false,
    balanced: false,
    aggressive: false,
  },
  bdexOracle: "",
  deployedAtBlock: 0,
} as const;

export function botChainById(chainId: number) {
  if (chainId === botChainTestnet.id) return botChainTestnet;
  if (chainId === botChainMainnet.id) return botChainMainnet;
  return undefined;
}

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
