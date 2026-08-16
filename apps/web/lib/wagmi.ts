import { botChainTestnet } from "@gren/shared";
import { defineChain } from "viem";
import { createConfig, http, injected } from "wagmi";

export const botChain = defineChain({
  id: botChainTestnet.id,
  name: botChainTestnet.name,
  nativeCurrency: botChainTestnet.nativeCurrency,
  rpcUrls: {
    default: { http: [botChainTestnet.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "BOT Chain Explorer",
      url: botChainTestnet.explorerUrl,
    },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [botChain],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [botChain.id]: http(botChainTestnet.rpcUrl),
  },
  ssr: true,
});
