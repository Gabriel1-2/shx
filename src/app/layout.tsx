import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { SolanaProvider } from "@/components/SolanaProvider";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/Toast";

const mono = JetBrains_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SHX | Swap Anything From Anywhere",
  description: "The trader-first DEX that works when others don't. Zero KYC. Self-custody. Access from any region.",
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
          <ToastProvider>
            <Header />
            {children}
            <SpeedInsights />
          </ToastProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}
