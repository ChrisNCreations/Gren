export type ViewId = "overview" | "vaults" | "decisions" | "activity";
export type ProfileId = "conservative" | "balanced" | "aggressive";

export const vaultProfiles = {
  conservative: {
    name: "Conservative",
    dex: 25,
    slippage: "0.5%",
    reserve: 75,
    accent: "sage",
    summary: "Prioritizes available liquidity with tightly bounded market exposure.",
  },
  balanced: {
    name: "Balanced",
    dex: 45,
    slippage: "0.8%",
    reserve: 55,
    accent: "peach",
    summary: "Balances a meaningful reserve with measured BDEX participation.",
  },
  aggressive: {
    name: "Aggressive",
    dex: 70,
    slippage: "1.2%",
    reserve: 30,
    accent: "sky",
    summary: "Allows higher market exposure while preserving hard policy limits.",
  },
} as const;
