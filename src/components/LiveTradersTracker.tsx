"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Activity, DollarSign, Zap, RefreshCw, TrendingUp } from "lucide-react";

interface LiveStats {
    walletsTraded: number;
    walletsTradedToday: number;
    tradersAllTime: number;
    tradersToday: number;
    totalVolume: number;
    totalTrades: number;
    totalFees: number;
    dailyVolume: number;
    dailyTrades: number;
    referralPaidUsd: number;
    recentTraders: Array<{
        wallet: string;
        volume: number;
        tradeCount: number;
        lastActive: string | null;
    }>;
    updatedAt: string;
    source?: string;
}

function fmt(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}

function fmtInt(n: number) {
    return Math.floor(n).toLocaleString();
}

function timeAgo(iso: string | null) {
    if (!iso) return "";
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
}

/**
 * Live tracker: unique wallets that have traded on SHX Exchange.
 */
export function LiveTradersTracker({
    variant = "card",
}: {
    variant?: "card" | "compact" | "hero";
}) {
    const [stats, setStats] = useState<LiveStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [pulse, setPulse] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/stats/live", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setStats((prev) => {
                if (
                    prev &&
                    data.walletsTraded > (prev.walletsTraded || prev.tradersAllTime || 0)
                ) {
                    setPulse(true);
                    setTimeout(() => setPulse(false), 1200);
                }
                return data;
            });
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 15_000);
        const onSwap = () => {
            setTimeout(load, 5_000);
            setTimeout(load, 15_000);
        };
        window.addEventListener("shx-swap-success", onSwap);
        return () => {
            clearInterval(interval);
            window.removeEventListener("shx-swap-success", onSwap);
        };
    }, [load]);

    const traders = stats?.walletsTraded ?? stats?.tradersAllTime ?? 0;
    const tradersToday = stats?.walletsTradedToday ?? stats?.tradersToday ?? 0;

    if (variant === "compact") {
        return (
            <div
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] md:text-[11px] font-mono transition-all ${
                    pulse
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-white/10 bg-white/5 text-muted-foreground"
                }`}
                title="Unique wallets that traded on SHX Exchange"
            >
                <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                </span>
                <Users size={11} className="text-primary" />
                <span className="text-white font-bold">{loading ? "…" : fmtInt(traders)}</span>
                <span className="hidden sm:inline">traders</span>
            </div>
        );
    }

    if (variant === "hero") {
        return (
            <div className="w-full rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-black/70 to-emerald-500/10 p-5 md:p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                            Live on Shulevitz Exchange
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => load()}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"
                        aria-label="Refresh"
                    >
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <HeroStat
                        label="Wallets traded"
                        value={loading ? "…" : fmtInt(traders)}
                        sub={`${fmtInt(tradersToday)} today`}
                        highlight={pulse}
                        icon={Users}
                    />
                    <HeroStat
                        label="Total volume"
                        value={loading ? "…" : fmt(stats?.totalVolume || 0)}
                        sub={`${fmt(stats?.dailyVolume || 0)} today`}
                        icon={DollarSign}
                    />
                    <HeroStat
                        label="Trades"
                        value={loading ? "…" : fmtInt(stats?.totalTrades || 0)}
                        sub={`${fmtInt(stats?.dailyTrades || 0)} today`}
                        icon={Activity}
                    />
                    <HeroStat
                        label="Fees generated"
                        value={loading ? "…" : fmt(stats?.totalFees || 0)}
                        sub={`Ref paid ${fmt(stats?.referralPaidUsd || 0)}`}
                        icon={Zap}
                    />
                </div>

                {stats?.recentTraders && stats.recentTraders.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                            <TrendingUp size={10} /> Recent traders
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {stats.recentTraders.slice(0, 8).map((t) => (
                                <div
                                    key={t.wallet + (t.lastActive || "")}
                                    className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/5 text-[10px] font-mono"
                                >
                                    <span className="text-white">{t.wallet}</span>
                                    <span className="text-muted-foreground ml-1.5">
                                        {fmt(t.volume)}
                                    </span>
                                    {t.lastActive && (
                                        <span className="text-muted-foreground/70 ml-1">
                                            · {timeAgo(t.lastActive)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Default card
    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-white">Live Traders</h3>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                    {stats?.updatedAt
                        ? `upd ${timeAgo(stats.updatedAt)}`
                        : "…"}
                </span>
            </div>
            <div className="p-4 space-y-4">
                <div
                    className={`text-center py-3 rounded-xl border transition-all ${
                        pulse
                            ? "border-primary bg-primary/15 scale-[1.02]"
                            : "border-white/5 bg-white/[0.02]"
                    }`}
                >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Unique wallets traded
                    </div>
                    <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400 font-mono">
                        {loading ? "…" : fmtInt(traders)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        <span className="text-green-400 font-bold">+{fmtInt(tradersToday)}</span>{" "}
                        active today (UTC)
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-[9px] text-muted-foreground uppercase">Volume</div>
                        <div className="text-sm font-bold text-white font-mono">
                            {fmt(stats?.totalVolume || 0)}
                        </div>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-[9px] text-muted-foreground uppercase">Trades</div>
                        <div className="text-sm font-bold text-white font-mono">
                            {fmtInt(stats?.totalTrades || 0)}
                        </div>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-[9px] text-muted-foreground uppercase">Fees</div>
                        <div className="text-sm font-bold text-primary font-mono">
                            {fmt(stats?.totalFees || 0)}
                        </div>
                    </div>
                </div>

                {stats?.recentTraders && stats.recentTraders.length > 0 && (
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                        {stats.recentTraders.slice(0, 6).map((t) => (
                            <div
                                key={t.wallet + String(t.lastActive)}
                                className="flex justify-between text-[11px] px-2 py-1 rounded bg-white/[0.02]"
                            >
                                <span className="font-mono text-muted-foreground">{t.wallet}</span>
                                <span className="text-white font-medium">
                                    {fmt(t.volume)} · {t.tradeCount}tx
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function HeroStat({
    label,
    value,
    sub,
    icon: Icon,
    highlight,
}: {
    label: string;
    value: string;
    sub: string;
    icon: typeof Users;
    highlight?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border p-3 transition-all ${
                highlight
                    ? "border-primary bg-primary/15"
                    : "border-white/10 bg-black/40"
            }`}
        >
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-1">
                <Icon size={11} className="text-primary" />
                {label}
            </div>
            <div className="text-xl md:text-2xl font-black text-white font-mono">{value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
        </div>
    );
}
