import type { Metadata } from "next";
import { Bricolage_Grotesque, Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "500", "600", "700", "800"],
});
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700"],
});
const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Metanoia — autonomous subscription procurement on Hyperswitch",
  description:
    "Give your agent a budget, not your card. Metanoia manages an AI team's API/software subscriptions under a spending mandate, buying and renewing through Juspay Hyperswitch and refusing anything outside policy.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${archivo.variable} ${jbmono.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
