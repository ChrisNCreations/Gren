export type ViewId = "overview" | "vaults" | "decisions" | "activity";
export type ProfileId = "conservative" | "balanced" | "aggressive";

export const vaultProfiles = {
  conservative: {
    name: "Conservative",
    dex: 25,
    slippage: "0.5%",
    reserve: 75,
    accent: "sage",
    summary: "Prioritizes available liquidity; BDEX remains disabled on this deployment.",
  },
  balanced: {
    name: "Balanced",
    dex: 45,
    slippage: "0.8%",
    reserve: 55,
    accent: "peach",
    summary: "Keeps a measured policy cap while this deployment remains reserve-only.",
  },
  aggressive: {
    name: "Aggressive",
    dex: 70,
    slippage: "1.2%",
    reserve: 30,
    accent: "sky",
    summary: "Defines a higher future exposure cap while this deployment remains reserve-only.",
  },
} as const;
