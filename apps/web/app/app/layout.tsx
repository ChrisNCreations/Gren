import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Gren vault",
  description: "USDT vault workspace for policy-bounded allocation on BOT Chain.",
};

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
