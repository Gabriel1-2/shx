"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { SHULEVITZ_MINT } from "@/lib/constants";
import {
    TrendingUp, TrendingDown, Activity, Zap,
    ChevronDown, BarChart2, Loader2, ExternalLink,
    DollarSign, ArrowDownUp, Droplets, PieChart
} from "lucide-react";

const JupiterTerminal = dynamic(() => import("@/components/JupiterTerminal"), {
    ssr: false,
    loading: () => <div className="w-full min-h-[420px] bg-white/5 animate-pulse rounded-2xl" />,
});

// ── Token Presets ──
const TOKENS = [
    { symbol: "SHX", name: "Shulevitz", address: SHULEVITZ_MINT, logo: "🟢" },
    { symbol: "SOL", name: "Solana", address: "So11111111111111111111111111111111111111112", logo: "◎" },
    { symbol: "BONK", name: "Bonk", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", logo: "🐕" },
    { symbol: "WIF", name: "dogwifhat", address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", logo: "🎩" },
    { symbol: "JUP", name: "Jupiter", address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", logo: "🪐" },
];

interface PairData {
    price: number;
    change24h: number;
    volume24h: number;
    liquidity: number;
    fdv: number;
    txns24h: { buys: number; sells: number };
    pairAddress: string;
    change1h: number;
    change6h: number;
}

// ── Data Fetcher ──
async function fetchPairData(address: string): Promise<PairData | null> {
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
        const data = await res.json();
        const pair = data.pairs?.sort(
            (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];
        if (!pair) return null;
        return {
            price: parseFloat(pair.priceUsd) || 0,
            change24h: pair.priceChange?.h24 || 0,
            change1h: pair.priceChange?.h1 || 0,
            change6h: pair.priceChange?.h6 || 0,
            volume24h: pair.volume?.h24 || 0,
            liquidity: pair.liquidity?.usd || 0,
            fdv: pair.fdv || 0,
            txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
            pairAddress: pair.pairAddress || "",
        };
    } catch {
        return null;
    }
}

// ── Components ──
function TokenStat({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className={`text-xs md:text-sm font-bold font-mono ${color || "text-white"}`}>{value}</span>
        </div>
    );
}

function ChangeChip({ value, label }: { value: number; label: string }) {
    const positive = value >= 0;
    return (
        <div className="flex flex-col items-center p-2.5 bg-white/[0.02] rounded-lg border border-white/5">
            <span className="text-[9px] text-muted-foreground uppercase mb-1">{label}</span>
            <span className={`text-xs font-bold font-mono flex items-center gap-0.5 ${positive ? "text-green-400" : "text-red-400"}`}>
                {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {positive ? "+" : ""}{value.toFixed(2)}%
            </span>
        </div>
    );
}

// ── Market Stats Panel (100% real data from DexScreener) ──
function MarketStats({ pairData, symbol }: { pairData: PairData | null; symbol: string }) {
    if (!pairData) return null;
    const totalTxns = (pairData.txns24h.buys || 0) + (pairData.txns24h.sells || 0);
    const buyRatio = totalTxns > 0 ? (pairData.txns24h.buys / totalTxns) * 100 : 50;

    const fmt = (n: number) => {
        if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
        if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
        return `$${n.toFixed(0)}`;
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                <Activity size={14} className="text-primary" />
                <h3 className="text-sm font-bold text-white">Market Stats</h3>
                <span className="text-[10px] text-muted-foreground ml-auto">Live from DexScreener</span>
            </div>

            {/* Price Changes */}
            <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/5">
                <ChangeChip value={pairData.change1h} label="1H" />
                <ChangeChip value={pairData.change6h} label="6H" />
                <ChangeChip value={pairData.change24h} label="24H" />
            </div>

            {/* Buy/Sell Ratio */}
            <div className="px-4 py-3 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted-foreground uppercase">Buy / Sell Pressure</span>
                    <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-green-400 font-bold">{pairData.txns24h.buys} buys</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-red-400 font-bold">{pairData.txns24h.sells} sells</span>
                    </div>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                    <div className="bg-green-500 transition-all duration-500" style={{ width: `${buyRatio}%` }} />
                    <div className="bg-red-500 transition-all duration-500" style={{ width: `${100 - buyRatio}%` }} />
                </div>
            </div>

            {/* Key Metrics */}
            <div className="divide-y divide-white/5">
                {[
                    { icon: DollarSign, label: "24h Volume", value: fmt(pairData.volume24h), color: "text-white" },
                    { icon: Droplets, label: "Pool Liquidity", value: fmt(pairData.liquidity), color: "text-cyan-400" },
                    { icon: PieChart, label: "Fully Diluted Value", value: fmt(pairData.fdv), color: "text-white" },
                    { icon: ArrowDownUp, label: "24h Transactions", value: totalTxns.toLocaleString(), color: "text-white" },
                ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2">
                            <item.icon size={12} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{item.label}</span>
                        </div>
                        <span className={`text-xs font-bold font-mono ${item.color}`}>{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Page ──
export default function ProPage() {
    const { connected } = useWallet();
    const [activeToken, setActiveToken] = useState(TOKENS[0]);
    const [pairData, setPairData] = useState<PairData | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartLoading, setChartLoading] = useState(true);
    const [showTokenList, setShowTokenList] = useState(false);

    const loadData = useCallback(async () => {
        const pair = await fetchPairData(activeToken.address);
        setPairData(pair);
        setLoading(false);
    }, [activeToken.address]);

    useEffect(() => {
        setLoading(true);
        setChartLoading(true);
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [loadData]);

    const fmt = (n: number) => {
        if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
        if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
        return `$${n.toFixed(0)}`;
    };

    const fmtPrice = (p: number) => {
        if (p < 0.0001) return `$${p.toExponential(2)}`;
        if (p < 1) return `$${p.toFixed(6)}`;
        return `$${p.toFixed(2)}`;
    };

    return (
        <main className="min-h-screen bg-background">
            {/* Token Stats Bar */}
            <div className="border-b border-white/5 bg-black/80 backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-[1800px] mx-auto px-3 md:px-6 py-2 flex items-center gap-3 md:gap-5 overflow-x-auto scrollbar-hide">
                    {/* Token Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowTokenList(!showTokenList)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                            <span className="text-base">{activeToken.logo}</span>
                            <span className="text-sm font-black text-white">{activeToken.symbol}<span className="text-muted-foreground font-normal">/USD</span></span>
                            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showTokenList ? "rotate-180" : ""}`} />
                        </button>
                        {showTokenList && (
                            <div className="absolute top-full mt-1 left-0 z-50 bg-black/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[200px]">
                                {TOKENS.map((t) => (
                                    <button
                                        key={t.address}
                                        onClick={() => { setActiveToken(t); setShowTokenList(false); }}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/10 transition-colors ${activeToken.address === t.address ? "bg-primary/10 text-primary" : "text-white"}`}
                                    >
                                        <span className="text-base">{t.logo}</span>
                                        <span className="font-bold text-sm">{t.symbol}</span>
                                        <span className="text-xs text-muted-foreground ml-auto">{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Live Price */}
                    <div className="flex items-center gap-2">
                        <span className="text-lg md:text-xl font-black text-white font-mono">
                            {loading ? "..." : fmtPrice(pairData?.price || 0)}
                        </span>
                        {pairData && (
                            <span className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${pairData.change24h >= 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
                                {pairData.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {pairData.change24h >= 0 ? "+" : ""}{pairData.change24h.toFixed(2)}%
                            </span>
                        )}
                    </div>

                    <div className="hidden md:contents">
                        <div className="w-px h-6 bg-white/10" />
                        <TokenStat label="24h Vol" value={loading ? "..." : fmt(pairData?.volume24h || 0)} />
                        <TokenStat label="Liquidity" value={loading ? "..." : fmt(pairData?.liquidity || 0)} color="text-cyan-400" />
                        <TokenStat label="FDV" value={loading ? "..." : fmt(pairData?.fdv || 0)} />
                        <div className="w-px h-6 bg-white/10" />
                        <TokenStat label="Buys" value={loading ? "..." : `${pairData?.txns24h.buys || 0}`} color="text-green-400" />
                        <TokenStat label="Sells" value={loading ? "..." : `${pairData?.txns24h.sells || 0}`} color="text-red-400" />
                    </div>

                    <a
                        href={`https://dexscreener.com/solana/${activeToken.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-white transition-colors shrink-0"
                    >
                        DexScreener <ExternalLink size={10} />
                    </a>
                </div>
            </div>

            {/* Mobile Stats */}
            <div className="md:hidden border-b border-white/5 bg-black/40 px-3 py-2 flex gap-4 overflow-x-auto scrollbar-hide">
                <TokenStat label="Vol" value={loading ? "..." : fmt(pairData?.volume24h || 0)} />
                <TokenStat label="Liq" value={loading ? "..." : fmt(pairData?.liquidity || 0)} color="text-cyan-400" />
                <TokenStat label="Buys" value={loading ? "..." : `${pairData?.txns24h.buys || 0}`} color="text-green-400" />
                <TokenStat label="Sells" value={loading ? "..." : `${pairData?.txns24h.sells || 0}`} color="text-red-400" />
            </div>

            {/* Main Grid */}
            <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-3 p-0 lg:p-3 min-h-[calc(100vh-120px)]">
                {/* Chart */}
                <div className="lg:col-span-8 xl:col-span-9 flex flex-col">
                    <div className="relative w-full flex-1 min-h-[350px] md:min-h-[500px] lg:min-h-0 bg-[#0A0A0A] lg:rounded-2xl lg:border lg:border-white/10 overflow-hidden">
                        {chartLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A] z-10">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="animate-spin text-primary" size={28} />
                                    <span className="text-sm text-muted-foreground">Loading Chart...</span>
                                </div>
                            </div>
                        )}
                        <iframe
                            src={`https://dexscreener.com/solana/${activeToken.address}?embed=1&theme=dark&trades=0&info=0`}
                            className="w-full h-full border-0 min-h-[350px] md:min-h-[500px] lg:min-h-[600px]"
                            onLoad={() => setChartLoading(false)}
                            title="Chart"
                            allow="clipboard-write"
                        />
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 p-3 lg:p-0">
                    {/* Jupiter Swap */}
                    <div className="rounded-2xl border border-primary/20 bg-black/40 backdrop-blur-xl overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.05)]">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
                            <div className="flex items-center gap-2">
                                <Zap size={14} className="text-primary" />
                                <h3 className="text-sm font-bold text-white">Swap</h3>
                            </div>
                            <span className="text-[10px] text-primary font-bold px-2 py-0.5 bg-primary/10 rounded-full">Jupiter Ultra</span>
                        </div>
                        <JupiterTerminal />
                    </div>

                    {/* Market Stats — 100% real data */}
                    <MarketStats pairData={pairData} symbol={activeToken.symbol} />
                </div>
            </div>
        </main>
    );
}
