import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./design-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gren",
  description: "AI-guided portfolio management on BOT Chain",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
