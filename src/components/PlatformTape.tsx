"use client";

/**
 * SHX platform live trade tape — real swaps settled through SHX (Firestore),
 * not generic chain noise. Moat: social proof + one-tap ape of output mint.
 */
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Activity, ExternalLink, Zap } from "lucide-react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { APP_TOKENS, SHULEVITZ_MINT } from "@/lib/constants";
import { useStore } from "@/store";
import { TokenAvatar } from "@/components/TokenAvatar";

interface PlatformTrade {
    id: string;
    wallet: string;
    volumeUSD: number;
    feeUsd: number;
    inputMint: string;
    outputMint: string;
    inputAmount: number;
    outputAmount: number;
    timestamp: Date | null;
}

function shortWallet(w: string) {
    if (!w || w.length < 8) return w || "???";
    return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

function timeAgo(d: Date | null) {
    if (!d) return "";
    const ms = Date.now() - d.getTime();
    if (ms < 15_000) return "now";
    if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
    return `${Math.floor(ms / 86_400_000)}d`;
}

function symbolFor(mint: string): string {
    const known = APP_TOKENS.find((t) => t.address === mint);
    if (known) return known.symbol;
    if (mint === SHULEVITZ_MINT) return "SHX";
    if (!mint) return "???";
    return mint.slice(0, 4);
}

function fmtUsd(n: number) {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n > 0) return `$${n.toFixed(3)}`;
    return "$0";
}

async function fetchPlatformTrades(n = 24): Promise<PlatformTrade[]> {
    try {
        const q = query(
            collection(db, "transactions"),
            orderBy("timestamp", "desc"),
            limit(n)
        );
        const snap = await getDocs(q);
        return snap.docs.map((doc) => {
            const d = doc.data();
            const ts = d.timestamp?.toDate?.() ?? (d.timestamp ? new Date(d.timestamp) : null);
            return {
                id: doc.id,
                wallet: d.wallet || "",
                volumeUSD: Number(d.volumeUSD || d.volumeUsd || 0),
                feeUsd: Number(d.feeUsd || d.feePaid || 0),
                inputMint: d.inputMint || "",
                outputMint: d.outputMint || "",
                inputAmount: Number(d.inputAmount || 0),
                outputAmount: Number(d.outputAmount || 0),
                timestamp: ts,
            };
        });
    } catch (e) {
        console.warn("[PlatformTape] fetch failed", e);
        return [];
    }
}

export function PlatformTape({ variant = "tape" }: { variant?: "tape" | "panel" }) {
    const router = useRouter();
    const { setPreferredOutputMint, setChartToken, setChartVisible } = useStore();
    const [trades, setTrades] = useState<PlatformTrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [flashId, setFlashId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const data = await fetchPlatformTrades();
        setTrades((prev) => {
            if (prev.length && data[0] && data[0].id !== prev[0]?.id) {
                setFlashId(data[0].id);
                setTimeout(() => setFlashId(null), 1400);
            }
            return data;
        });
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        const i = setInterval(load, 12_000);
        const onSwap = () => {
            setTimeout(load, 4_000);
            setTimeout(load, 12_000);
        };
        window.addEventListener("shx-swap-success", onSwap);
        return () => {
            clearInterval(i);
            window.removeEventListener("shx-swap-success", onSwap);
        };
    }, [load]);

    const ape = (mint: string, symbol: string) => {
        if (!mint) return;
        setPreferredOutputMint(mint);
        setChartToken({ address: mint, symbol });
        setChartVisible(true);
        router.push(`/pro?mint=${mint}&symbol=${encodeURIComponent(symbol)}`);
    };

    if (variant === "panel") {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <Activity size={14} className="text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Traded on SHX</h3>
                    <span className="text-[10px] text-muted-foreground ml-auto">Live ledger</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                    {loading && trades.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
                    )}
                    {!loading && trades.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-8 px-4">
                            No trades yet — be the first on the tape.
                        </p>
                    )}
                    {trades.map((t) => {
                        const outSym = symbolFor(t.outputMint);
                        const inSym = symbolFor(t.inputMint);
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => ape(t.outputMint, outSym)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors ${
                                    flashId === t.id ? "bg-primary/15" : ""
                                }`}
                            >
                                <TokenAvatar mint={t.outputMint} symbol={outSym} size={28} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-white truncate">
                                        {inSym} → {outSym}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                        {shortWallet(t.wallet)} · {timeAgo(t.timestamp)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-mono font-bold text-emerald-400">
                                        {fmtUsd(t.volumeUSD)}
                                    </div>
                                    <div className="text-[9px] text-primary font-bold">APE</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Horizontal marquee-style tape
    return (
        <div className="w-full rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-black/60 to-black/40 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                    SHX trade tape
                </span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    Real swaps on this exchange · tap to ape the out token
                </span>
                <Zap size={12} className="text-emerald-400 ml-auto" />
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-3 py-2.5 md:py-3 snap-x snap-mandatory">
                {loading && trades.length === 0 &&
                    Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="shrink-0 w-40 md:w-44 h-[68px] md:h-[72px] rounded-xl bg-white/5 animate-pulse snap-start"
                        />
                    ))}
                {!loading && trades.length === 0 && (
                    <div className="shrink-0 px-4 py-3 text-xs text-muted-foreground">
                        Waiting for the first SHX-settled trade…
                    </div>
                )}
                {trades.map((t) => {
                    const outSym = symbolFor(t.outputMint);
                    const inSym = symbolFor(t.inputMint);
                    const isShx = t.outputMint === SHULEVITZ_MINT || t.inputMint === SHULEVITZ_MINT;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => ape(t.outputMint, outSym)}
                            className={`shrink-0 w-[11.5rem] md:w-48 snap-start rounded-xl border p-2.5 text-left transition-all active:scale-[0.97] hover:scale-[1.02] ${
                                flashId === t.id
                                    ? "border-primary bg-primary/20"
                                    : isShx
                                      ? "border-primary/30 bg-primary/10"
                                      : "border-white/10 bg-black/50 hover:border-emerald-500/30"
                            }`}
                        >
                            <div className="flex items-center gap-1.5 mb-1">
                                <TokenAvatar mint={t.inputMint} symbol={inSym} size={18} />
                                <span className="text-[10px] text-muted-foreground">→</span>
                                <TokenAvatar mint={t.outputMint} symbol={outSym} size={18} />
                                <span className="text-[11px] font-black text-white truncate ml-0.5">
                                    {outSym}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-mono font-bold text-emerald-400">
                                    {fmtUsd(t.volumeUSD)}
                                </span>
                                <span className="text-[9px] text-muted-foreground font-mono">
                                    {timeAgo(t.timestamp)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[9px] text-muted-foreground font-mono">
                                    {shortWallet(t.wallet)}
                                </span>
                                <a
                                    href={`https://solscan.io/tx/${t.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted-foreground hover:text-white"
                                    aria-label="View on Solscan"
                                >
                                    <ExternalLink size={10} />
                                </a>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
