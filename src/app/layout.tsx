import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SolanaProvider } from "@/components/SolanaProvider";
import { Header } from "@/components/Header";

const mono = JetBrains_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SHX Exchange",
  description: "Trader-first, non-custodial Solana exchange.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={mono.className} suppressHydrationWarning>
        <SolanaProvider>
          <Header />
          {children}
        </SolanaProvider>
      </body>
    </html>
  );
}
