import { defineChain } from "viem";
import { createConfig, http, injected } from "wagmi";
import { publicChainConfig } from "@/lib/public-config";

export const botChain = defineChain({
  id: publicChainConfig.chainId,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [publicChainConfig.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "BOT Chain Explorer",
      url: publicChainConfig.explorerUrl,
    },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [botChain],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [botChain.id]: http(publicChainConfig.rpcUrl),
  },
  ssr: true,
});
