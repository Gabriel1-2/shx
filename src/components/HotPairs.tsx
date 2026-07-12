"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Flame, TrendingUp, TrendingDown, Zap, ExternalLink } from "lucide-react";
import { useStore } from "@/store";
import { SHULEVITZ_MINT } from "@/lib/constants";

export interface HotPair {
    address: string;
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    volume24h: number;
    liquidity: number;
    imageUrl?: string;
}

function fmtVol(n: number) {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
}

function fmtPrice(p: number) {
    if (p <= 0) return "—";
    if (p < 0.0001) return `$${p.toExponential(1)}`;
    if (p < 1) return `$${p.toFixed(5)}`;
    return `$${p.toFixed(2)}`;
}

async function fetchHotPairs(): Promise<HotPair[]> {
    const results: HotPair[] = [];
    const seen = new Set<string>();

    // Always pin SHX first
    try {
        const shxRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${SHULEVITZ_MINT}`
        );
        const shxData = await shxRes.json();
        const pair = (shxData.pairs || []).sort(
            (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];
        if (pair) {
            seen.add(SHULEVITZ_MINT);
            results.push({
                address: SHULEVITZ_MINT,
                symbol: "SHX",
                name: "Shulevitz",
                price: parseFloat(pair.priceUsd || "0"),
                change24h: pair.priceChange?.h24 || 0,
                volume24h: pair.volume?.h24 || 0,
                liquidity: pair.liquidity?.usd || 0,
                imageUrl: "/icons/icon-192.png",
            });
        }
    } catch {
        /* continue */
    }

    // Trending / boosted Solana tokens
    try {
        const boostRes = await fetch("https://api.dexscreener.com/token-boosts/top/v1");
        if (boostRes.ok) {
            const boosts = await boostRes.json();
            const solBoosts = (Array.isArray(boosts) ? boosts : [])
                .filter((b: any) => b.chainId === "solana" && b.tokenAddress)
                .slice(0, 20);

            for (const b of solBoosts) {
                const mint = b.tokenAddress as string;
                if (seen.has(mint)) continue;
                seen.add(mint);

                // Enrich with pair data
                try {
                    const pr = await fetch(
                        `https://api.dexscreener.com/latest/dex/tokens/${mint}`
                    );
                    const pd = await pr.json();
                    const pair = (pd.pairs || [])
                        .filter((p: any) => p.chainId === "solana")
                        .sort(
                            (a: any, b: any) =>
                                (b.volume?.h24 || 0) - (a.volume?.h24 || 0)
                        )[0];
                    if (!pair) continue;
                    results.push({
                        address: mint,
                        symbol: pair.baseToken?.symbol || b.symbol || "???",
                        name: pair.baseToken?.name || b.description || mint.slice(0, 6),
                        price: parseFloat(pair.priceUsd || "0"),
                        change24h: pair.priceChange?.h24 || 0,
                        volume24h: pair.volume?.h24 || 0,
                        liquidity: pair.liquidity?.usd || 0,
                        imageUrl: b.icon || pair.info?.imageUrl,
                    });
                } catch {
                    /* skip */
                }
                if (results.length >= 12) break;
            }
        }
    } catch {
        /* fallback below */
    }

    // Fallback: high-volume search if boosts empty
    if (results.length < 4) {
        try {
            const majors = [
                "So11111111111111111111111111111111111111112",
                "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
                "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
                "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
            ];
            for (const mint of majors) {
                if (seen.has(mint)) continue;
                const pr = await fetch(
                    `https://api.dexscreener.com/latest/dex/tokens/${mint}`
                );
                const pd = await pr.json();
                const pair = (pd.pairs || []).sort(
                    (a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0)
                )[0];
                if (!pair) continue;
                seen.add(mint);
                results.push({
                    address: mint,
                    symbol: pair.baseToken?.symbol || "???",
                    name: pair.baseToken?.name || "",
                    price: parseFloat(pair.priceUsd || "0"),
                    change24h: pair.priceChange?.h24 || 0,
                    volume24h: pair.volume?.h24 || 0,
                    liquidity: pair.liquidity?.usd || 0,
                    imageUrl: pair.info?.imageUrl,
                });
            }
        } catch {
            /* ignore */
        }
    }

    return results;
}

/**
 * Live hot pairs tape — Photon-style discovery feeding SHX Pro / swap.
 * Unique combo: discovery + 0% SHX pin + Ultra execution.
 */
export function HotPairs({
    onSelect,
    variant = "tape",
}: {
    onSelect?: (pair: HotPair) => void;
    variant?: "tape" | "grid";
}) {
    const router = useRouter();
    const { setChartToken, setChartVisible, setPreferredOutputMint } = useStore();
    const [pairs, setPairs] = useState<HotPair[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await fetchHotPairs();
            setPairs(data);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const i = setInterval(load, 45_000);
        return () => clearInterval(i);
    }, [load]);

    const handleClick = (p: HotPair) => {
        if (onSelect) {
            onSelect(p);
            return;
        }
        setChartToken({ address: p.address, symbol: p.symbol });
        setPreferredOutputMint(p.address);
        setChartVisible(true);
        // Pro desk with this token
        router.push(`/pro?mint=${p.address}&symbol=${encodeURIComponent(p.symbol)}`);
    };

    if (variant === "grid") {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <Flame size={14} className="text-orange-400" />
                    <h3 className="text-sm font-bold text-white">Hot on Solana</h3>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                        Tap → trade on SHX
                    </span>
                </div>
                <div className="p-2 grid grid-cols-1 gap-1 max-h-80 overflow-y-auto">
                    {loading && (
                        <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
                    )}
                    {pairs.map((p) => (
                        <button
                            key={p.address}
                            type="button"
                            onClick={() => handleClick(p)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                        >
                            {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-full" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-white/10" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-white">{p.symbol}</div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                    {fmtVol(p.volume24h)} vol
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-mono text-white">
                                    {fmtPrice(p.price)}
                                </div>
                                <div
                                    className={`text-[10px] font-bold ${
                                        p.change24h >= 0 ? "text-green-400" : "text-red-400"
                                    }`}
                                >
                                    {p.change24h >= 0 ? "+" : ""}
                                    {p.change24h.toFixed(1)}%
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Horizontal tape
    return (
        <div className="w-full rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-black/60 to-black/40 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                <Flame size={14} className="text-orange-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-300">
                    Live tape
                </span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    SHX pinned · trending Solana · one tap to Pro Ultra
                </span>
                <Zap size={12} className="text-primary ml-auto" />
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-3 py-3">
                {loading &&
                    Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="shrink-0 w-36 h-20 rounded-xl bg-white/5 animate-pulse"
                        />
                    ))}
                {pairs.map((p) => {
                    const up = p.change24h >= 0;
                    const isShx = p.address === SHULEVITZ_MINT;
                    return (
                        <button
                            key={p.address}
                            type="button"
                            onClick={() => handleClick(p)}
                            className={`shrink-0 w-40 rounded-xl border p-3 text-left transition-all hover:scale-[1.03] ${
                                isShx
                                    ? "border-primary/40 bg-primary/10 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                                    : "border-white/10 bg-black/50 hover:border-white/20"
                            }`}
                        >
                            <div className="flex items-center gap-1.5 mb-1.5">
                                {p.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={p.imageUrl}
                                        alt=""
                                        className="w-5 h-5 rounded-full"
                                    />
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-white/10" />
                                )}
                                <span className="text-xs font-black text-white truncate">
                                    {p.symbol}
                                </span>
                                {isShx && (
                                    <span className="text-[8px] font-bold text-primary bg-primary/20 px-1 rounded">
                                        0% FEE
                                    </span>
                                )}
                            </div>
                            <div className="text-sm font-mono font-bold text-white">
                                {fmtPrice(p.price)}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <span
                                    className={`text-[10px] font-bold flex items-center gap-0.5 ${
                                        up ? "text-green-400" : "text-red-400"
                                    }`}
                                >
                                    {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                    {up ? "+" : ""}
                                    {p.change24h.toFixed(1)}%
                                </span>
                                <span className="text-[9px] text-muted-foreground font-mono">
                                    {fmtVol(p.volume24h)}
                                </span>
                            </div>
                        </button>
                    );
                })}
                <a
                    href="https://dexscreener.com/solana"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 w-28 rounded-xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-white hover:border-white/30"
                >
                    <ExternalLink size={14} />
                    <span className="text-[10px] font-bold">More</span>
                </a>
            </div>
        </div>
    );
}
