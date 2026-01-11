"use client";

import { Suspense, useState } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { FeeTransparency } from "@/components/FeeTransparency";
import { SystemStatus } from "@/components/SystemStatus";
import { MarketWatch } from "@/components/MarketWatch";
import { LiveFeed } from "@/components/LiveFeed";
import CustomSwap from "@/components/CustomSwap";
import { TradingViewWidget } from "@/components/TradingViewWidget";
import { SHULEVITZ_MINT } from "@/lib/constants";
import { useReferralCapture } from "@/hooks/useReferralCapture";
import { Zap, Shield, Globe, TrendingUp } from "lucide-react";

function HomeContent() {
  useReferralCapture();

  // State for Dynamic Layout
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [chartPairAddress, setChartPairAddress] = useState(SHULEVITZ_MINT);

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] bg-primary/20 blur-[200px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-15%] w-[50%] h-[50%] bg-purple-500/15 blur-[180px] rounded-full"></div>
        <div className="absolute top-[40%] right-[5%] w-[30%] h-[30%] bg-cyan-500/10 blur-[150px] rounded-full"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50"></div>
      </div>

      <div className={`relative z-10 container mx-auto px-4 py-6 md:py-12 flex flex-col lg:block transition-all duration-500 ${isChartVisible ? 'max-w-[1600px]' : 'max-w-7xl'}`}>

        {/* Hero Section - Always Visible */}
        <div className={`text-center mb-6 md:mb-10 order-2 lg:order-none mt-8 lg:mt-0 transition-all duration-500`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 transition-all">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-medium text-primary">Frankfurt Node Active • Geo-Bypass Enabled</span>
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              SHADOW ROUTER
            </span>
            <br />
            <span className="text-white">UNSTOPPABLE DEX</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            The trader-first DEX that works when others don't.
            Zero KYC. Self-custody. Access from any region.
          </p>
        </div>

        {/* Feature Pills - Always Visible */}
        <div className="flex flex-wrap justify-center gap-3 mb-10 order-3 lg:order-none">
          {[
            { icon: Shield, label: "Non-Custodial", color: "text-green-400" },
            { icon: Globe, label: "No Geo-Blocks", color: "text-blue-400" },
            { icon: Zap, label: "Jupiter Routing", color: "text-yellow-400" },
            { icon: TrendingUp, label: "Fee Rewards", color: "text-purple-400" },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <feature.icon size={14} className={feature.color} />
              <span className="text-xs font-medium text-white">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* Dynamic Grid */}
        <div className={`grid gap-6 transition-all duration-500 ${isChartVisible ? 'lg:grid-cols-12' : 'lg:grid-cols-12 xl:grid-cols-12'}`}>
          {/* Note: Using 12-col grid for both modes allows flexible rearrangement */}

          {/* LEFT COLUMN */}
          {/* Chart Mode: Chart (8 cols) */}
          {/* Simple Mode: Market Watch (3 cols) */}
          {isChartVisible ? (
            <div className="hidden lg:block lg:col-span-8 space-y-4 animate-in fade-in slide-in-from-right duration-500">
              <TradingViewWidget pairAddress={chartPairAddress} />
              {/* Stats under chart */}
              <div className="grid grid-cols-2 gap-4">
                <MarketWatch />
                <LiveFeed />
              </div>
            </div>
          ) : (
            <div className="hidden xl:block xl:col-span-3 space-y-4 animate-in fade-in slide-in-from-left duration-500">
              <MarketWatch />
              <LiveFeed />
              {/* Mobile/Tablet users might miss this content if we hide it too aggressively on lg. 
                    Let's keep it XL only for the full dashboard look. */}
            </div>
          )}

          {/* CENTER/RIGHT COLUMN */}
          {/* Chart Mode: Swap (4 cols) */}
          {/* Simple Mode: Swap (6 cols centered) */}
          <div className={`${isChartVisible ? 'lg:col-span-4' : 'lg:col-span-12 xl:col-span-6 flex flex-col items-center'} transition-all duration-500`}>
            {/* Wrapper to control width in centered mode */}
            <div className={`w-full ${isChartVisible ? '' : 'max-w-md mx-auto'} transition-all`}>
              <CustomSwap
                onToggleChart={() => setIsChartVisible(!isChartVisible)}
                onPairChange={(addr) => setChartPairAddress(addr)}
                isChartOpen={isChartVisible}
              />

              {/* Trust Badges */}
              <div className="flex items-center justify-center gap-6 mt-6 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span className="text-[10px] uppercase tracking-wider">Operational</span>
                </div>
                <div className="h-3 w-px bg-white/10"></div>
                <span className="text-[10px] uppercase tracking-wider">Verified Routes</span>
              </div>

              {/* Mobile Sidebars Stack */}
              <div className="xl:hidden w-full mt-8 space-y-4">
                {/* Show these if not in chart mode or if using mobile */}
                {!isChartVisible && (
                  <>
                    <MarketWatch />
                    <LiveFeed />
                    <FeeTransparency />
                    <SystemStatus />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (Simple Mode Only) */}
          {/* Only visible when Chart is CLOSED */}
          {!isChartVisible && (
            <div className="hidden xl:block xl:col-span-3 space-y-4 animate-in fade-in slide-in-from-right duration-500">
              <Leaderboard />
              <FeeTransparency />
              <SystemStatus />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground tracking-[0.3em] uppercase opacity-50">
            Non-Custodial • Solana Native • Trader First
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
