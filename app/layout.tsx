import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metanoia — autonomous subscription procurement on Hyperswitch",
  description:
    "Give your agent a budget, not your card. Metanoia manages an AI team's API/software subscriptions under a spending mandate, buying and renewing through Juspay Hyperswitch and refusing anything outside policy.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
