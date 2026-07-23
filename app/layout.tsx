import type { Metadata } from "next";
import "./globals.css";

const appUrl = "https://metanoia-e3w3a6ohka-ue.a.run.app";
const description =
  "Give your agent a budget, not your card. Metanoia uses deterministic ranking and spending controls to procure API subscriptions through Juspay Hyperswitch.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Metanoia | AI Subscription Procurement on Hyperswitch",
  description,
  applicationName: "Metanoia",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: appUrl,
    siteName: "Metanoia",
    title: "Metanoia | AI Subscription Procurement on Hyperswitch",
    description,
  },
  twitter: {
    card: "summary",
    title: "Metanoia | AI Subscription Procurement on Hyperswitch",
    description,
  },
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
