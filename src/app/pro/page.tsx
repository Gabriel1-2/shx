"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { APP_TOKENS, SHULEVITZ_MINT, TokenInfo } from "@/lib/constants";
import { HotPairs } from "@/components/HotPairs";
import { PlatformTape } from "@/components/PlatformTape";
import { WeeklyRace } from "@/components/WeeklyRace";
import { BuySHXButton } from "@/components/BuySHXButton";
import { useStore } from "@/store";
import {
    TrendingUp, TrendingDown, Activity, Zap,
    ChevronDown, BarChart2, Loader2, ExternalLink,
    DollarSign, ArrowDownUp, Droplets, PieChart,
    Target, RefreshCw, List, Search
} from "lucide-react";

const JupiterTerminal = dynamic(() => import("@/components/JupiterTerminal"), {
    ssr: false,
    loading: () => <div className="w-full min-h-[420px] bg-white/5 animate-pulse rounded-2xl" />,
});

const LimitOrderPanel = dynamic(() => import("@/components/LimitOrderPanel"), {
    ssr: false,
    loading: () => <div className="w-full min-h-[420px] bg-white/5 animate-pulse rounded-2xl" />,
});

const DCAPanel = dynamic(() => import("@/components/DCAPanel"), {
    ssr: false,
    loading: () => <div className="w-full min-h-[420px] bg-white/5 animate-pulse rounded-2xl" />,
});

const OrdersPanel = dynamic(() => import("@/components/OrdersPanel"), {
    ssr: false,
    loading: () => <div className="w-full min-h-[420px] bg-white/5 animate-pulse rounded-2xl" />,
});

function TokenLogo({ token, size = 20 }: { token: typeof APP_TOKENS[0]; size?: number }) {
    if (token.isImage) {
        return <Image src={token.logo} alt={token.symbol} width={size} height={size} className="rounded-full" />;
    }
    return <span style={{ fontSize: size * 0.8 }}>{token.logo}</span>;
}

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
function ProPageInner() {
    const { connected } = useWallet();
    const searchParams = useSearchParams();
    const setPreferredOutputMint = useStore((s) => s.setPreferredOutputMint);
    const setChartToken = useStore((s) => s.setChartToken);
    const [activeToken, setActiveToken] = useState<TokenInfo>(APP_TOKENS[0]);
    const [pairData, setPairData] = useState<PairData | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartLoading, setChartLoading] = useState(true);
    const [showTokenList, setShowTokenList] = useState(false);
    const [tokenSearch, setTokenSearch] = useState("");
    const [searchHits, setSearchHits] = useState<TokenInfo[]>([]);
    const [searching, setSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<"swap" | "limit" | "dca" | "orders">("swap");

    // Deep-link ?mint= & symbol=
    useEffect(() => {
        const mint = searchParams.get("mint");
        const symbol = searchParams.get("symbol") || "TOKEN";
        if (mint) {
            const known = APP_TOKENS.find((t) => t.address === mint);
            const tok: TokenInfo = known || {
                symbol,
                name: symbol,
                address: mint,
                logo: "◎",
                isImage: false,
                decimals: 9,
            };
            setActiveToken(tok);
            setPreferredOutputMint(mint);
            setChartToken({ address: mint, symbol });
        }
    }, [searchParams, setPreferredOutputMint, setChartToken]);

    const selectToken = (tok: TokenInfo) => {
        setActiveToken(tok);
        setPreferredOutputMint(tok.address);
        setChartToken({ address: tok.address, symbol: tok.symbol });
        setShowTokenList(false);
        setTokenSearch("");
        setSearchHits([]);
        setChartLoading(true);
        setActiveTab("swap");
    };

    // Jupiter token search for full Solana universe
    useEffect(() => {
        if (!tokenSearch || tokenSearch.length < 2) {
            setSearchHits([]);
            return;
        }
        let cancelled = false;
        setSearching(true);
        const t = setTimeout(async () => {
            try {
                const ds = await fetch(
                    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(tokenSearch)}`
                );
                const data = await ds.json();
                if (cancelled) return;
                const pairs = (data.pairs || [])
                    .filter((p: any) => p.chainId === "solana")
                    .slice(0, 15);
                const mapped: TokenInfo[] = pairs.map((p: any) => ({
                    symbol: p.baseToken?.symbol || "???",
                    name: p.baseToken?.name || "",
                    address: p.baseToken?.address || "",
                    logo: p.info?.imageUrl || "◎",
                    isImage: !!p.info?.imageUrl,
                    decimals: 9,
                })).filter((t: TokenInfo) => t.address);
                // Dedupe
                const seen = new Set<string>();
                const unique = mapped.filter((t) => {
                    if (seen.has(t.address)) return false;
                    seen.add(t.address);
                    return true;
                });
                setSearchHits(unique);
            } catch {
                if (!cancelled) setSearchHits([]);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 350);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [tokenSearch]);

    const loadData = useCallback(async () => {
        const pair = await fetchPairData(activeToken.address);
        setPairData(pair);
        setLoading(false);
    }, [activeToken.address]);

    useEffect(() => {
        const init = () => {
            setLoading(true);
            setChartLoading(true);
            loadData();
        };
        init();
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
        <main className="min-h-screen bg-background pb-2">
            {/* Token Stats Bar — sticky under site header */}
            <div className="border-b border-white/5 bg-black/85 backdrop-blur-2xl sticky top-[calc(env(safe-area-inset-top)+3rem)] md:top-16 z-40">
                <div className="max-w-[1800px] mx-auto px-2.5 md:px-6 py-2 flex items-center gap-2 md:gap-5 overflow-x-auto scrollbar-hide">
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setShowTokenList(!showTokenList)}
                            className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-2 min-h-[40px] rounded-xl bg-white/5 border border-white/10 active:bg-white/10 transition-colors"
                        >
                            <TokenLogo token={activeToken} size={18} />
                            <span className="text-xs md:text-sm font-black text-white">
                                {activeToken.symbol}
                                <span className="text-muted-foreground font-normal hidden xs:inline">/USD</span>
                            </span>
                            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showTokenList ? "rotate-180" : ""}`} />
                        </button>
                        {showTokenList && (
                            <div className="absolute top-full mt-1 left-0 z-50 bg-black/98 border border-white/10 rounded-2xl overflow-hidden shadow-2xl w-[min(92vw,300px)]">
                                <div className="p-2 border-b border-white/5">
                                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/5">
                                        <Search size={14} className="text-muted-foreground" />
                                        <input
                                            autoFocus
                                            value={tokenSearch}
                                            onChange={(e) => setTokenSearch(e.target.value)}
                                            placeholder="Search token…"
                                            className="flex-1 bg-transparent text-base md:text-xs text-white outline-none"
                                        />
                                        {searching && <Loader2 size={12} className="animate-spin text-primary" />}
                                    </div>
                                </div>
                                <div className="max-h-[50vh] overflow-y-auto overscroll-contain">
                                    {(tokenSearch.length >= 2 ? searchHits : APP_TOKENS).map((token) => (
                                        <button
                                            key={token.address}
                                            onClick={() => selectToken(token)}
                                            className={`w-full px-4 py-3 flex items-center gap-3 active:bg-white/10 transition-colors min-h-[48px] ${activeToken.address === token.address ? "bg-primary/10 text-primary" : "text-white"}`}
                                        >
                                            <TokenLogo token={token} size={22} />
                                            <span className="font-bold text-sm">{token.symbol}</span>
                                            <span className="text-xs text-muted-foreground ml-auto truncate max-w-[100px]">{token.name}</span>
                                        </button>
                                    ))}
                                    {tokenSearch.length >= 2 && searchHits.length === 0 && !searching && (
                                        <p className="text-xs text-muted-foreground text-center py-4">No results</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="hidden sm:block shrink-0">
                        <BuySHXButton size="sm" />
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                        <span className="text-sm md:text-xl font-black text-white font-mono">
                            {loading ? "…" : fmtPrice(pairData?.price || 0)}
                        </span>
                        {pairData && (
                            <span className={`flex items-center gap-0.5 text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded-md ${pairData.change24h >= 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
                                {pairData.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {pairData.change24h >= 0 ? "+" : ""}{pairData.change24h.toFixed(1)}%
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

            {/* Mobile stats strip — snap chips */}
            <div className="md:hidden border-b border-white/5 bg-black/50 px-2.5 py-2 flex gap-2 overflow-x-auto scrollbar-hide snap-x">
                {[
                    { label: "Vol", value: loading ? "…" : fmt(pairData?.volume24h || 0), c: "text-white" },
                    { label: "Liq", value: loading ? "…" : fmt(pairData?.liquidity || 0), c: "text-cyan-400" },
                    { label: "FDV", value: loading ? "…" : fmt(pairData?.fdv || 0), c: "text-white" },
                    { label: "Buys", value: loading ? "…" : `${pairData?.txns24h.buys || 0}`, c: "text-green-400" },
                    { label: "Sells", value: loading ? "…" : `${pairData?.txns24h.sells || 0}`, c: "text-red-400" },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="snap-start shrink-0 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-1.5 min-w-[4.5rem]"
                    >
                        <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">
                            {s.label}
                        </div>
                        <div className={`text-[11px] font-bold font-mono ${s.c}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Hot pairs — mobile discovery above trade */}
            <div className="max-w-[1800px] mx-auto px-2.5 lg:px-3 pt-2.5 md:pt-3">
                <HotPairs
                    onSelect={(p) => {
                        selectToken({
                            symbol: p.symbol,
                            name: p.name,
                            address: p.address,
                            logo: p.imageUrl || "◎",
                            isImage: !!p.imageUrl,
                            decimals: 9,
                        });
                    }}
                />
            </div>

            {/*
              Mobile: trade first (order-1), chart second (order-2)
              Desktop: chart left, trade right
            */}
            <div className="max-w-[1800px] mx-auto flex flex-col lg:grid lg:grid-cols-12 gap-0 lg:gap-3 p-0 lg:p-3 min-h-0 lg:min-h-[calc(100vh-120px)] pb-2">
                {/* Chart */}
                <div className="order-2 lg:order-1 lg:col-span-8 xl:col-span-9 flex flex-col mt-2 lg:mt-0 px-2.5 lg:px-0">
                    <div className="relative w-full flex-1 min-h-[220px] sm:min-h-[280px] md:min-h-[500px] lg:min-h-0 bg-[#0A0A0A] rounded-2xl border border-white/10 overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                        {chartLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A] z-10">
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="animate-spin text-primary" size={24} />
                                    <span className="text-xs text-muted-foreground">Chart…</span>
                                </div>
                            </div>
                        )}
                        <iframe
                            src={`https://dexscreener.com/solana/${activeToken.address}?embed=1&theme=dark&trades=0&info=0`}
                            className="w-full h-full border-0 min-h-[220px] sm:min-h-[280px] md:min-h-[500px] lg:min-h-[600px]"
                            onLoad={() => setChartLoading(false)}
                            title="Chart"
                            allow="clipboard-write"
                        />
                    </div>
                </div>

                {/* Trade sidebar — first on mobile */}
                <div className="order-1 lg:order-2 lg:col-span-4 xl:col-span-3 flex flex-col gap-2.5 md:gap-3 p-2.5 lg:p-0">
                    {/* Segmented tabs — larger touch targets on phone */}
                    <div className="flex rounded-2xl bg-black/50 border border-white/10 p-1 gap-0.5 backdrop-blur-xl">
                        {([
                            { id: "swap" as const, label: "Swap", icon: Zap, color: "text-green-400" },
                            { id: "limit" as const, label: "Limit", icon: Target, color: "text-amber-400" },
                            { id: "dca" as const, label: "DCA", icon: RefreshCw, color: "text-blue-400" },
                            { id: "orders" as const, label: "Orders", short: "Ords", icon: List, color: "text-purple-400" },
                        ]).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 min-h-[44px] sm:min-h-0 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all active:scale-[0.97] ${
                                    activeTab === tab.id
                                        ? `bg-white/10 ${tab.color} shadow-[0_0_16px_rgba(34,197,94,0.12)]`
                                        : "text-muted-foreground active:text-white"
                                }`}
                            >
                                <tab.icon size={14} />
                                <span className="sm:hidden">{tab.short || tab.label}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-primary/25 bg-black/50 backdrop-blur-xl overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.08)] mobile-terminal-shell">
                        {activeTab === "swap" && (
                            <>
                                <div className="hidden sm:flex px-4 py-3 border-b border-white/5 items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
                                    <div className="flex items-center gap-2">
                                        <Zap size={14} className="text-primary" />
                                        <h3 className="text-sm font-bold text-white">Swap</h3>
                                    </div>
                                    <span className="text-[10px] text-primary font-bold px-2 py-0.5 bg-primary/10 rounded-full">
                                        Jupiter Ultra
                                    </span>
                                </div>
                                <JupiterTerminal />
                            </>
                        )}
                        {activeTab === "limit" && <LimitOrderPanel />}
                        {activeTab === "dca" && <DCAPanel />}
                        {activeTab === "orders" && <OrdersPanel />}
                    </div>

                    <div className="space-y-2.5 md:space-y-3">
                        <MarketStats pairData={pairData} symbol={activeToken.symbol} />
                        <div className="hidden sm:block">
                            <HotPairs
                                variant="grid"
                                onSelect={(p) => {
                                    selectToken({
                                        symbol: p.symbol,
                                        name: p.name,
                                        address: p.address,
                                        logo: p.imageUrl || "◎",
                                        isImage: !!p.imageUrl,
                                        decimals: 9,
                                    });
                                }}
                            />
                        </div>
                        <PlatformTape variant="panel" />
                        <WeeklyRace />
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function ProPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <ProPageInner />
        </Suspense>
    );
}
