import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SolanaProvider } from "@/components/SolanaProvider";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/Toast";
import { QueryProvider } from "@/components/QueryProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BackgroundSyncer } from "@/components/BackgroundSyncer";
import DebugLogsViewer from "@/components/DebugLogs";
import { ReferralCapture } from "@/components/ReferralCapture";
import { ReferralBanner } from "@/components/ReferralBanner";
import { Onboarding } from "@/components/Onboarding";
import { TradeToastListener } from "@/components/TradeToastListener";
import { MobileNav } from "@/components/MobileNav";
import { TrustProofBar } from "@/components/TrustProofBar";

const mono = JetBrains_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shulevitz Exchange | Elite Solana Trading",
  description:
    "Jupiter Ultra routes · SHX fee tiers · USDC referral payouts · Limit & DCA · Agent API. Non-custodial Solana trading that pays loyalty.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SHX",
  },
  openGraph: {
    title: "Shulevitz Exchange",
    description:
      "Elite execution + paid loyalty. Best Solana routes, fee discounts for SHX holders, USDC referrals, agent-native API.",
    type: "website",
    url: "https://shx.exchange",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shulevitz Exchange",
    description: "Elite Solana trading. Hold SHX. Earn USDC referrals.",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={mono.className} suppressHydrationWarning>
        <QueryProvider>
          <ErrorBoundary>
            <SolanaProvider>
              <ToastProvider>
                <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/20 blur-[100px] rounded-full mix-blend-screen animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }} />
                </div>
                <Header />
                <TrustProofBar />
                <BackgroundSyncer />
                <Suspense fallback={null}>
                  <ReferralCapture />
                  <ReferralBanner />
                  <MobileNav />
                </Suspense>
                <Onboarding />
                <TradeToastListener />
                <DebugLogsViewer />
                <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0 min-h-[50vh]">
                  {children}
                </div>
                <footer className="border-t border-white/5 bg-black/60 backdrop-blur-xl mt-auto mb-[calc(4.5rem+env(safe-area-inset-bottom))] md:mb-0 print:hidden">
                  <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-3">
                    <span className="text-[10px] md:text-xs text-muted-foreground text-center">
                      © 2026 Shulevitz Holdings Inc.
                    </span>
                    <div className="flex items-center gap-3 md:gap-4 flex-wrap justify-center">
                      <a href="/referrals" className="text-[10px] md:text-xs text-emerald-400/80 hover:text-emerald-400 transition-colors">Referrals</a>
                      <a href="/partners" className="text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors">Partners</a>
                      <a href="/pro" className="text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors">Pro</a>
                      <a href="/api/mcp" className="text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors hidden sm:inline">MCP</a>
                      <a href="/whitepaper" className="text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors">Paper</a>
                      <a href="/privacy" className="text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors">Privacy</a>
                      <a href="/terms" className="text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors">Terms</a>
                    </div>
                  </div>
                </footer>
              </ToastProvider>
            </SolanaProvider>
          </ErrorBoundary>
        </QueryProvider>
      </body>
    </html>
  );
}
