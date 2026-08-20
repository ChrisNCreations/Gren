import { defineChain } from "viem";
import { createConfig, http, injected } from "wagmi";
import { publicChainConfig } from "@/lib/public-config";

export const botChain = defineChain({
  id: publicChainConfig.chainId,
  name: publicChainConfig.name,
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
  testnet: publicChainConfig.isTestnet,
});

export const wagmiConfig = createConfig({
  chains: [botChain],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [botChain.id]: http(publicChainConfig.rpcUrl),
  },
  ssr: true,
});
