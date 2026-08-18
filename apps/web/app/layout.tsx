import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Web3Provider } from "@/components/web3-provider";
import "./design-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gren",
  description: "Policy-bounded USDT vaults on BOT Chain. The agent proposes; contracts decide.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><Web3Provider>{children}</Web3Provider></body>
    </html>
  );
}
