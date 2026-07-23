import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metanoia · autonomous subscription procurement on Hyperswitch",
  description:
    "Give your agent a budget, not your card. Metanoia manages an AI team's API/software subscriptions under a spending mandate, buying and renewing through Juspay Hyperswitch and refusing anything outside policy.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout is the correct place */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
