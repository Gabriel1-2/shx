"use client";

import { Suspense } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { FeeTransparency } from "@/components/FeeTransparency";
import { SystemStatus } from "@/components/SystemStatus";
import { MarketWatch } from "@/components/MarketWatch";
import { LiveFeed } from "@/components/LiveFeed";
import { LiveTradersTracker } from "@/components/LiveTradersTracker";
import { WhySHX } from "@/components/WhySHX";
import { SavingsCalculator } from "@/components/SavingsCalculator";
import { QualifyProgress } from "@/components/QualifyProgress";
import { PayoutsFeed } from "@/components/PayoutsFeed";
import { HotPairs } from "@/components/HotPairs";
import { PlatformTape } from "@/components/PlatformTape";
import { WeeklyRace } from "@/components/WeeklyRace";
import { BuySHXButton } from "@/components/BuySHXButton";
import { MobileExplore } from "@/components/MobileExplore";
import dynamic from "next/dynamic";

import { TradingViewWidget } from "@/components/TradingViewWidget";
import { Zap, Shield, Globe, TrendingUp, BarChart2, Minimize2, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const JupiterTerminal = dynamic(() => import("@/components/JupiterTerminal"), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[420px] md:min-h-[500px] rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent animate-pulse" />
  ),
});

import { useStore } from "@/store";

function HomeContent() {
  const { isChartVisible, chartToken, toggleChartVisible } = useStore();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const isMarketsMobile = tab === "markets";

  return (
    <main className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Ambient — lighter on mobile for performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-20%] w-[70%] h-[45%] bg-primary/25 md:bg-primary/20 blur-[100px] md:blur-[200px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-15%] w-[55%] h-[40%] bg-purple-500/15 blur-[90px] md:blur-[180px] rounded-full hidden sm:block" />
        <div className="absolute top-[40%] right-[5%] w-[30%] h-[30%] bg-cyan-500/10 blur-[150px] rounded-full hidden md:block" />
      </div>

      <div
        className={`relative z-10 container mx-auto px-3 sm:px-4 py-3 md:py-12 flex flex-col lg:block transition-all duration-500 ${
          isChartVisible ? "max-w-[1600px]" : "max-w-7xl"
        }`}
      >
        {/* ─── MOBILE: swap-first hero ─── */}
        {!isMarketsMobile && (
          <div className="md:hidden mb-3 animate-fadeIn">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <h1 className="text-[15px] font-black tracking-tight leading-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-lime-400 to-emerald-400">
                    Trade Solana.
                  </span>{" "}
                  <span className="text-white">Keep keys.</span>
                </h1>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Ultra routes · paid loyalty · no KYC
                </p>
              </div>
              <Link
                href="/pro"
                className="shrink-0 flex items-center gap-0.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white active:scale-95 transition-transform"
              >
                Pro
                <ChevronRight size={12} className="text-primary" />
              </Link>
            </div>

            {/* Compact trust chips */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-0.5 px-0.5">
              {[
                { icon: Shield, label: "Non-custodial", c: "text-green-400" },
                { icon: Zap, label: "Jupiter Ultra", c: "text-yellow-400" },
                { icon: TrendingUp, label: "Best routes", c: "text-purple-400" },
                { icon: Globe, label: "No geo blocks", c: "text-blue-400" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.04] border border-white/8"
                >
                  <f.icon size={10} className={f.c} />
                  <span className="text-[9px] font-semibold text-white/80">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── DESKTOP hero ─── */}
        <div
          className={`text-center mb-4 md:mb-10 mt-0 md:mt-4 hidden md:block transition-all duration-500 ${
            isMarketsMobile ? "hidden md:block" : ""
          }`}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-primary">
              Jupiter Ultra • Best Routes
            </span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-lime-400 to-emerald-500">
              SHULEVITZ EXCHANGE
            </span>
            <br />
            <span className="text-white text-4xl lg:text-5xl">
              Elite execution. Paid loyalty.
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base px-4">
            Jupiter Ultra routes · SHX fee tiers · USDC referrals · Agent API ·
            Limit &amp; DCA. Self-custody. Zero KYC.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <BuySHXButton size="lg" />
            <a
              href="/pro"
              className="inline-flex items-center px-6 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10"
            >
              Open Pro Desk
            </a>
          </div>
        </div>

        {/* Desktop-only stacks above terminal */}
        <div className="hidden md:block mb-4 max-w-2xl mx-auto">
          <QualifyProgress />
        </div>
        <div className="hidden md:block mb-4">
          <HotPairs />
        </div>
        <div className="hidden md:block mb-6">
          <PlatformTape />
        </div>
        <div className="hidden md:block mb-8">
          <LiveTradersTracker variant="hero" />
        </div>

        <div className="hidden md:flex flex-wrap justify-center gap-3 mb-10">
          {[
            { icon: Shield, label: "Non-Custodial", color: "text-green-400" },
            { icon: Globe, label: "No Geo-Blocks", color: "text-blue-400" },
            { icon: Zap, label: "Jupiter Ultra", color: "text-yellow-400" },
            { icon: TrendingUp, label: "Best Routes", color: "text-purple-400" },
          ].map((feature, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
            >
              <feature.icon size={12} className={feature.color} />
              <span className="text-xs font-medium text-white">
                {feature.label}
              </span>
            </div>
          ))}
        </div>

        {/* ─── MOBILE MARKETS TAB ─── */}
        {isMarketsMobile && (
          <div className="md:hidden space-y-3 animate-fadeIn pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-white">Markets</h2>
              <Link
                href="/"
                className="text-[11px] font-bold text-primary active:opacity-70"
              >
                ← Back to Swap
              </Link>
            </div>
            <HotPairs />
            <div className="rounded-2xl overflow-hidden border border-white/10 min-h-[280px]">
              <TradingViewWidget
                tokenAddress={chartToken.address}
                symbol={chartToken.symbol}
              />
            </div>
            <MarketWatch />
            <PlatformTape />
            <LiveFeed tokenAddress={chartToken.address} />
          </div>
        )}

        {/* Dynamic Grid */}
        <div
          className={`grid gap-4 md:gap-6 transition-all duration-500 ${
            isChartVisible ? "lg:grid-cols-12" : "lg:grid-cols-12 xl:grid-cols-12"
          }`}
        >
          {isChartVisible ? (
            <div className="hidden lg:block lg:col-span-8 space-y-4">
              <TradingViewWidget
                tokenAddress={chartToken.address}
                symbol={chartToken.symbol}
              />
              <div className="grid grid-cols-2 gap-4">
                <MarketWatch />
                <LiveFeed tokenAddress={chartToken.address} />
              </div>
            </div>
          ) : (
            <div className="hidden xl:block xl:col-span-3 space-y-4">
              <MarketWatch />
              <LiveFeed tokenAddress={chartToken.address} />
            </div>
          )}

          {/* CENTER — Terminal first on mobile */}
          <div
            className={`${
              isChartVisible
                ? "lg:col-span-4"
                : "lg:col-span-12 xl:col-span-6 flex flex-col items-center"
            } transition-all duration-500`}
          >
            <div
              className={`w-full ${isChartVisible ? "" : "max-w-md mx-auto"}`}
            >
              <div
                className={`hidden md:flex justify-end mb-3 ${
                  isMarketsMobile ? "hidden" : ""
                }`}
              >
                <button
                  onClick={toggleChartVisible}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    isChartVisible
                      ? "bg-primary/20 border-primary text-primary"
                      : "hover:bg-white/10 border-white/10 text-muted-foreground"
                  }`}
                >
                  {isChartVisible ? (
                    <Minimize2 size={12} />
                  ) : (
                    <BarChart2 size={12} />
                  )}
                  {isChartVisible ? "Hide Chart" : "Show Chart"}
                </button>
              </div>

              {/* Terminal — primary mobile surface */}
              <div
                className={`${
                  isMarketsMobile ? "hidden md:block" : "block"
                } mobile-terminal-shell`}
              >
                <JupiterTerminal />
              </div>

              {/* Mobile accordion moat sections */}
              {!isMarketsMobile && <MobileExplore />}

              {/* Tablet/md side content */}
              <div className="hidden md:block xl:hidden w-full mt-6 space-y-4 pb-8">
                {!isChartVisible && (
                  <>
                    <MarketWatch />
                    <Leaderboard />
                    <FeeTransparency />
                    <LiveFeed tokenAddress={chartToken.address} />
                  </>
                )}
              </div>
            </div>
          </div>

          {!isChartVisible && (
            <div className="hidden xl:block xl:col-span-3 space-y-4">
              <LiveTradersTracker />
              <WeeklyRace />
              <PlatformTape variant="panel" />
              <SavingsCalculator />
              <PayoutsFeed />
              <Leaderboard />
              <FeeTransparency />
              <SystemStatus />
            </div>
          )}
        </div>

        <div className={`mt-10 md:mt-20 ${isMarketsMobile ? "hidden md:block" : ""}`}>
          <div className="hidden md:block">
            <WhySHX />
          </div>
        </div>

        <div className="mt-8 md:mt-12 text-center pb-2 md:pb-4">
          <p className="text-[9px] md:text-xs text-muted-foreground tracking-[0.25em] uppercase opacity-40">
            Non-Custodial · Solana · Jupiter · Agent Ready
          </p>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}
