"use client";

import { Suspense } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { FeeTransparency } from "@/components/FeeTransparency";
import { SystemStatus } from "@/components/SystemStatus";
import { MarketWatch } from "@/components/MarketWatch";
import { LiveFeed } from "@/components/LiveFeed";
import CustomSwap from "@/components/CustomSwap";
import { useReferralCapture } from "@/hooks/useReferralCapture";
import { Zap, Shield, Globe, TrendingUp } from "lucide-react";

function HomeContent() {
  useReferralCapture();

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] bg-primary/20 blur-[200px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-15%] w-[50%] h-[50%] bg-purple-500/15 blur-[180px] rounded-full"></div>
        <div className="absolute top-[40%] right-[5%] w-[30%] h-[30%] bg-cyan-500/10 blur-[150px] rounded-full"></div>
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-12 flex flex-col lg:block">

        {/* Hero Section */}
        <div className="text-center mb-6 md:mb-10 order-2 lg:order-none mt-8 lg:mt-0">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-medium text-primary">Frankfurt Node Active • Geo-Bypass Enabled</span>
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-lime-400 to-emerald-500">
              SWAP ANYTHING
            </span>
            <br />
            <span className="text-white">FROM ANYWHERE</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            The trader-first DEX that works when others don't.
            Zero KYC. Self-custody. Access from any region.
          </p>
        </div>

        {/* Feature Pills */}
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

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-12 max-w-7xl mx-auto order-1 lg:order-none w-full">

          {/* Left Sidebar - Market Watch */}
          <div className="hidden xl:block xl:col-span-3 space-y-4">
            <MarketWatch />
            <LiveFeed />
          </div>

          {/* Center - Swap Interface */}
          <div className="lg:col-span-12 xl:col-span-6 flex flex-col items-center">
            <CustomSwap />

            {/* Trust Badges */}
            <div className="flex items-center justify-center gap-6 mt-6 text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <span className="text-[10px] uppercase tracking-wider">Operational</span>
              </div>
              <div className="h-3 w-px bg-white/10"></div>
              <span className="text-[10px] uppercase tracking-wider">Verified Routes</span>
              <div className="h-3 w-px bg-white/10"></div>
              <span className="text-[10px] uppercase tracking-wider">Best Prices</span>
            </div>

            {/* Mobile sidebars */}
            <div className="xl:hidden w-full max-w-md mt-8 space-y-4">
              <MarketWatch />
              <LiveFeed />
              <FeeTransparency />
              <SystemStatus />
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="hidden xl:block xl:col-span-3 space-y-4">
            <Leaderboard />
            <FeeTransparency />
            <SystemStatus />
          </div>

        </div>

        {/* Bottom Stats Bar */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 md:gap-16 pt-8 border-t border-white/5">
          {[
            { label: "Total Volume", value: "$0" },
            { label: "Swaps Executed", value: "0" },
            { label: "Active Traders", value: "0" },
            { label: "Avg. Fee", value: "0.5%" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Footer Tagline */}
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
