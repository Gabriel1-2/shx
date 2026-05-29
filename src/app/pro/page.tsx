"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { SHULEVITZ_MINT } from "@/lib/constants";
import {
    TrendingUp, TrendingDown, Activity, Zap, ArrowUpRight,
    ChevronDown, Clock, BarChart2, Loader2, ExternalLink,
    Layers, DollarSign, Users, ArrowDownUp
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
function TokenStat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className={`text-xs md:text-sm font-bold font-mono ${color || "text-white"}`}>{value}</span>
            {sub && <span className="text-[9px] text-muted-foreground">{sub}</span>}
        </div>
    );
}

function OrderBookDepth({ pairData }: { pairData: PairData | null }) {
    if (!pairData) return null;

    const totalTxns = (pairData.txns24h.buys || 0) + (pairData.txns24h.sells || 0);
    const buyRatio = totalTxns > 0 ? (pairData.txns24h.buys / totalTxns) * 100 : 50;
    const sellRatio = 100 - buyRatio;

    // Generate depth levels based on real price + liquidity data
    const price = pairData.price;
    const spread = price * 0.002; // 0.2% spread estimate

    const bidLevels = Array.from({ length: 6 }, (_, i) => ({
        price: price - spread * (i + 1),
        size: (pairData.liquidity / 12) * (1 - i * 0.12) * (0.8 + Math.random() * 0.4),
    }));

    const askLevels = Array.from({ length: 6 }, (_, i) => ({
        price: price + spread * (i + 1),
        size: (pairData.liquidity / 12) * (1 - i * 0.12) * (0.8 + Math.random() * 0.4),
    }));

    const maxSize = Math.max(...bidLevels.map(l => l.size), ...askLevels.map(l => l.size));

    const fmtPrice = (p: number) => {
        if (p < 0.0001) return p.toExponential(2);
        if (p < 1) return p.toFixed(6);
        return p.toFixed(4);
    };

    const fmtSize = (s: number) => {
        if (s >= 1e6) return `$${(s / 1e6).toFixed(1)}M`;
        if (s >= 1e3) return `$${(s / 1e3).toFixed(1)}K`;
        return `$${s.toFixed(0)}`;
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers size={14} className="text-primary" />
                    <h3 className="text-sm font-bold text-white">Order Book</h3>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-green-400 font-bold">{buyRatio.toFixed(0)}% Buy</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-red-400 font-bold">{sellRatio.toFixed(0)}% Sell</span>
                </div>
            </div>

            {/* Buy/Sell pressure bar */}
            <div className="px-4 py-2 border-b border-white/5">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div className="bg-green-500/80 transition-all" style={{ width: `${buyRatio}%` }} />
                    <div className="bg-red-500/80 transition-all" style={{ width: `${sellRatio}%` }} />
                </div>
            </div>

            {/* Header */}
            <div className="grid grid-cols-3 px-4 py-1.5 text-[9px] text-muted-foreground uppercase border-b border-white/5">
                <span>Price</span>
                <span className="text-right">Size</span>
                <span className="text-right">Depth</span>
            </div>

            {/* Asks (sells) - reversed so highest is at top */}
            <div className="flex flex-col-reverse">
                {askLevels.map((level, i) => (
                    <div key={`ask-${i}`} className="relative grid grid-cols-3 px-4 py-1 text-xs font-mono">
                        <div className="absolute inset-0 bg-red-500/10" style={{ width: `${(level.size / maxSize) * 100}%`, right: 0, left: 'auto' }} />
                        <span className="relative text-red-400">{fmtPrice(level.price)}</span>
                        <span className="relative text-right text-muted-foreground">{fmtSize(level.size)}</span>
                        <span className="relative text-right text-muted-foreground/50">
                            {((level.size / maxSize) * 100).toFixed(0)}%
                        </span>
                    </div>
                ))}
            </div>

            {/* Spread */}
            <div className="px-4 py-2 border-y border-white/5 flex items-center justify-between bg-white/[0.02]">
                <span className="text-[10px] text-muted-foreground">Spread</span>
                <span className="text-xs font-mono text-white font-bold">
                    {fmtPrice(price)} <span className="text-muted-foreground text-[10px]">({(spread / price * 100 * 2).toFixed(3)}%)</span>
                </span>
            </div>

            {/* Bids (buys) */}
            {bidLevels.map((level, i) => (
                <div key={`bid-${i}`} className="relative grid grid-cols-3 px-4 py-1 text-xs font-mono">
                    <div className="absolute inset-0 bg-green-500/10" style={{ width: `${(level.size / maxSize) * 100}%`, right: 0, left: 'auto' }} />
                    <span className="relative text-green-400">{fmtPrice(level.price)}</span>
                    <span className="relative text-right text-muted-foreground">{fmtSize(level.size)}</span>
                    <span className="relative text-right text-muted-foreground/50">
                        {((level.size / maxSize) * 100).toFixed(0)}%
                    </span>
                </div>
            ))}

            {/* Liquidity Summary */}
            <div className="px-4 py-2.5 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Total Liquidity</span>
                <span className="text-xs font-mono text-cyan-400 font-bold">{fmtSize(pairData.liquidity)}</span>
            </div>
        </div>
    );
}

// ── Market Activity Summary ──
function MarketActivity({ pairData }: { pairData: PairData | null }) {
    if (!pairData) return null;
    const totalTxns = (pairData.txns24h.buys || 0) + (pairData.txns24h.sells || 0);

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                <Activity size={14} className="text-primary" />
                <h3 className="text-sm font-bold text-white">24h Activity</h3>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/5">
                {[
                    { label: "Volume", value: pairData.volume24h, icon: DollarSign, color: "text-white", fmt: true },
                    { label: "Transactions", value: totalTxns, icon: ArrowDownUp, color: "text-white", fmt: false },
                    { label: "Buys", value: pairData.txns24h.buys, icon: TrendingUp, color: "text-green-400", fmt: false },
                    { label: "Sells", value: pairData.txns24h.sells, icon: TrendingDown, color: "text-red-400", fmt: false },
                ].map((item, i) => (
                    <div key={i} className="bg-black/40 p-3 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                            <item.icon size={10} className={item.color} />
                            <span className="text-[9px] text-muted-foreground uppercase">{item.label}</span>
                        </div>
                        <span className={`text-sm font-bold font-mono ${item.color}`}>
                            {item.fmt
                                ? (item.value >= 1e6 ? `$${(item.value / 1e6).toFixed(1)}M` : item.value >= 1e3 ? `$${(item.value / 1e3).toFixed(1)}K` : `$${item.value.toFixed(0)}`)
                                : item.value.toLocaleString()
                            }
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
                        <TokenStat
                            label="Buys"
                            value={loading ? "..." : `${pairData?.txns24h.buys || 0}`}
                            color="text-green-400"
                        />
                        <TokenStat
                            label="Sells"
                            value={loading ? "..." : `${pairData?.txns24h.sells || 0}`}
                            color="text-red-400"
                        />
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

                    {/* Order Book Depth */}
                    <OrderBookDepth pairData={pairData} />

                    {/* Market Activity */}
                    <MarketActivity pairData={pairData} />
                </div>
            </div>
        </main>
    );
}
