"use client";

import { Suspense, useState } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { FeeTransparency } from "@/components/FeeTransparency";
import { SystemStatus } from "@/components/SystemStatus";
import { MarketWatch } from "@/components/MarketWatch";
import { LiveFeed } from "@/components/LiveFeed";
import dynamic from "next/dynamic";
import { SHULEVITZ_MINT } from "@/lib/constants";

import { TradingViewWidget } from "@/components/TradingViewWidget";
import { Zap, Shield, Globe, TrendingUp, BarChart2, Minimize2 } from "lucide-react";

// Dynamically import Jupiter Terminal (needs window/document)
const JupiterTerminal = dynamic(() => import("@/components/JupiterTerminal"), {
  ssr: false,
  loading: () => <div className="w-full min-h-[500px] bg-white/5 animate-pulse rounded-2xl" />
});

function HomeContent() {


  const [isChartVisible, setIsChartVisible] = useState(false);
  const [chartToken, setChartToken] = useState({ address: SHULEVITZ_MINT, symbol: "SHULEVITZ" });

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

        {/* Hero Section */}
        <div className="text-center mb-4 md:mb-10 mt-4 lg:mt-0 transition-all duration-500">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] md:text-xs font-medium text-primary">Jupiter Ultra • Best Routes</span>
          </div>
          <h1 className="text-2xl md:text-5xl lg:text-6xl font-black mb-2 md:mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              SHX EXCHANGE
            </span>
            <br />
            <span className="text-white text-xl md:text-5xl lg:text-6xl">SWAP ANYTHING</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-xs md:text-base px-4">
            Best routes, best prices. Zero KYC. Self-custody.
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-6 md:mb-10">
          {[
            { icon: Shield, label: "Non-Custodial", color: "text-green-400" },
            { icon: Globe, label: "No Geo-Blocks", color: "text-blue-400" },
            { icon: Zap, label: "Jupiter Ultra", color: "text-yellow-400" },
            { icon: TrendingUp, label: "Best Routes", color: "text-purple-400" },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 md:px-4 py-1.5 md:py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <feature.icon size={12} className={feature.color} />
              <span className="text-[10px] md:text-xs font-medium text-white">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* Dynamic Grid */}
        <div className={`grid gap-6 transition-all duration-500 ${isChartVisible ? 'lg:grid-cols-12' : 'lg:grid-cols-12 xl:grid-cols-12'}`}>

          {/* LEFT COLUMN */}
          {isChartVisible ? (
            <div className="hidden lg:block lg:col-span-8 space-y-4 animate-in fade-in slide-in-from-right duration-500">
              <TradingViewWidget tokenAddress={chartToken.address} symbol={chartToken.symbol} />
              <div className="grid grid-cols-2 gap-4">
                <MarketWatch />
                <LiveFeed tokenAddress={chartToken.address} />
              </div>
            </div>
          ) : (
            <div className="hidden xl:block xl:col-span-3 space-y-4 animate-in fade-in slide-in-from-left duration-500">
              <MarketWatch />
              <LiveFeed tokenAddress={chartToken.address} />
            </div>
          )}

          {/* CENTER COLUMN — Jupiter Terminal */}
          <div className={`${isChartVisible ? 'lg:col-span-4' : 'lg:col-span-12 xl:col-span-6 flex flex-col items-center'} transition-all duration-500`}>
            <div className={`w-full ${isChartVisible ? '' : 'max-w-md mx-auto'} transition-all`}>

              {/* Chart Toggle */}
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => setIsChartVisible(!isChartVisible)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isChartVisible ? 'bg-primary/20 border-primary text-primary' : 'hover:bg-white/10 border-white/10 text-muted-foreground'}`}
                >
                  {isChartVisible ? <Minimize2 size={12} /> : <BarChart2 size={12} />}
                  {isChartVisible ? 'Hide Chart' : 'Show Chart'}
                </button>
              </div>

              {/* Jupiter Terminal Widget */}
              <JupiterTerminal />

              {/* Mobile Sidebars Stack */}
              <div className="xl:hidden w-full mt-6 space-y-4">
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

          {/* RIGHT COLUMN (Simple Mode Only) */}
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
            Non-Custodial • Solana Native • Jupiter Powered
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
