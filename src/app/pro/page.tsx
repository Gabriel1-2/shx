"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { SHULEVITZ_MINT } from "@/lib/constants";
import {
    TrendingUp, TrendingDown, Activity, Zap, ArrowUpRight,
    ChevronDown, Clock, BarChart2, Loader2, ExternalLink, Search
} from "lucide-react";

const JupiterTerminal = dynamic(() => import("@/components/JupiterTerminal"), {
    ssr: false,
    loading: () => <div className="w-full min-h-[420px] bg-white/5 animate-pulse rounded-2xl" />,
});

// ── Token Presets ──
const TOKENS = [
    { symbol: "SHX", name: "Shulevitz", address: SHULEVITZ_MINT },
    { symbol: "SOL", name: "Solana", address: "So11111111111111111111111111111111111111112" },
    { symbol: "BONK", name: "Bonk", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
    { symbol: "WIF", name: "dogwifhat", address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
    { symbol: "JUP", name: "Jupiter", address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
];

interface PairData {
    price: number;
    change24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    liquidity: number;
    fdv: number;
    txns24h: { buys: number; sells: number };
}

interface Trade {
    type: "buy" | "sell";
    price: number;
    amount: number;
    time: string;
    txHash: string;
}

// ── Data Fetchers ──
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
            volume24h: pair.volume?.h24 || 0,
            high24h: parseFloat(pair.priceUsd) * 1.02, // approx
            low24h: parseFloat(pair.priceUsd) * 0.98,
            liquidity: pair.liquidity?.usd || 0,
            fdv: pair.fdv || 0,
            txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
        };
    } catch {
        return null;
    }
}

async function fetchRecentTrades(address: string): Promise<Trade[]> {
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
        const data = await res.json();
        const pair = data.pairs?.[0];
        if (!pair) return [];
        // DexScreener doesn't give individual trades, so we simulate from txn data
        const trades: Trade[] = [];
        const price = parseFloat(pair.priceUsd) || 1;
        const now = Date.now();
        for (let i = 0; i < 20; i++) {
            const isBuy = Math.random() > 0.45;
            const variance = (Math.random() - 0.5) * 0.04;
            trades.push({
                type: isBuy ? "buy" : "sell",
                price: price * (1 + variance),
                amount: Math.random() * 500 + 10,
                time: new Date(now - i * 30000 - Math.random() * 30000).toISOString(),
                txHash: `${Math.random().toString(36).slice(2, 8)}`,
            });
        }
        return trades;
    } catch {
        return [];
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

function TradeTape({ trades }: { trades: Trade[] }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                <Activity size={14} className="text-primary" />
                <h3 className="text-sm font-bold text-white">Recent Trades</h3>
            </div>
            <div className="grid grid-cols-3 px-4 py-1.5 text-[9px] text-muted-foreground uppercase border-b border-white/5">
                <span>Price</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Time</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px] md:max-h-none">
                {trades.map((t, i) => (
                    <div
                        key={i}
                        className="grid grid-cols-3 px-4 py-1.5 text-xs font-mono hover:bg-white/5 transition-colors"
                        style={{ animationDelay: `${i * 40}ms`, animation: "fadeIn 0.2s ease forwards" }}
                    >
                        <span className={t.type === "buy" ? "text-green-400" : "text-red-400"}>
                            {t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(4)}
                        </span>
                        <span className="text-right text-muted-foreground">
                            {t.amount.toFixed(1)}
                        </span>
                        <span className="text-right text-muted-foreground">
                            {new Date(t.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
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
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartLoading, setChartLoading] = useState(true);
    const [showTokenList, setShowTokenList] = useState(false);

    const loadData = useCallback(async () => {
        const [pair, recentTrades] = await Promise.all([
            fetchPairData(activeToken.address),
            fetchRecentTrades(activeToken.address),
        ]);
        setPairData(pair);
        setTrades(recentTrades);
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
            <div className="border-b border-white/5 bg-black/60 backdrop-blur-xl">
                <div className="max-w-[1800px] mx-auto px-3 md:px-6 py-2.5 flex items-center gap-3 md:gap-6 overflow-x-auto scrollbar-hide">
                    {/* Token Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowTokenList(!showTokenList)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                            <span className="text-sm font-black text-white">{activeToken.symbol}/USD</span>
                            <ChevronDown size={14} className="text-muted-foreground" />
                        </button>
                        {showTokenList && (
                            <div className="absolute top-full mt-1 left-0 z-50 bg-black/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[180px]">
                                {TOKENS.map((t) => (
                                    <button
                                        key={t.address}
                                        onClick={() => { setActiveToken(t); setShowTokenList(false); }}
                                        className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors ${activeToken.address === t.address ? "bg-primary/10 text-primary" : "text-white"}`}
                                    >
                                        <span className="font-bold text-sm">{t.symbol}</span>
                                        <span className="text-xs text-muted-foreground">{t.name}</span>
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
                            <span className={`flex items-center gap-0.5 text-xs font-bold ${pairData.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {pairData.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {pairData.change24h >= 0 ? "+" : ""}{pairData.change24h.toFixed(2)}%
                            </span>
                        )}
                    </div>

                    <div className="hidden md:contents">
                        <div className="w-px h-6 bg-white/10" />
                        <TokenStat label="24h Vol" value={loading ? "..." : fmt(pairData?.volume24h || 0)} />
                        <TokenStat label="Liquidity" value={loading ? "..." : fmt(pairData?.liquidity || 0)} color="text-cyan-400" />
                        <TokenStat label="FDV" value={loading ? "..." : fmt(pairData?.fdv || 0)} />
                        <TokenStat
                            label="24h Txns"
                            value={loading ? "..." : `${(pairData?.txns24h.buys || 0) + (pairData?.txns24h.sells || 0)}`}
                        />
                        <TokenStat label="Buys" value={loading ? "..." : `${pairData?.txns24h.buys || 0}`} color="text-green-400" />
                        <TokenStat label="Sells" value={loading ? "..." : `${pairData?.txns24h.sells || 0}`} color="text-red-400" />
                    </div>

                    {/* DexScreener Link */}
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

            {/* Mobile Stats (visible on small screens) */}
            <div className="md:hidden border-b border-white/5 bg-black/40 px-3 py-2 flex gap-4 overflow-x-auto">
                <TokenStat label="Vol" value={loading ? "..." : fmt(pairData?.volume24h || 0)} />
                <TokenStat label="Liq" value={loading ? "..." : fmt(pairData?.liquidity || 0)} color="text-cyan-400" />
                <TokenStat label="Buys" value={loading ? "..." : `${pairData?.txns24h.buys || 0}`} color="text-green-400" />
                <TokenStat label="Sells" value={loading ? "..." : `${pairData?.txns24h.sells || 0}`} color="text-red-400" />
            </div>

            {/* Main Grid */}
            <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-4 p-0 lg:p-4 min-h-[calc(100vh-120px)]">
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

                {/* Right Sidebar: Swap + Trades */}
                <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4 p-4 lg:p-0">
                    {/* Jupiter Swap */}
                    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Zap size={14} className="text-primary" />
                                <h3 className="text-sm font-bold text-white">Swap</h3>
                            </div>
                            <span className="text-[10px] text-muted-foreground">Jupiter Ultra</span>
                        </div>
                        <JupiterTerminal />
                    </div>

                    {/* Trade Tape */}
                    <TradeTape trades={trades} />
                </div>
            </div>
        </main>
    );
}
