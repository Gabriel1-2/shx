"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, DollarSign, Banknote, Shield, Sparkles } from "lucide-react";

/**
 * Always-on social proof — the moat competitors can't fake without real ledger data.
 */
export function TrustProofBar() {
    const [stats, setStats] = useState({
        traders: 0,
        volume: 0,
        fees: 0,
        paid: 0,
    });

    useEffect(() => {
        const load = async () => {
            try {
                const [live, payouts] = await Promise.all([
                    fetch("/api/stats/live").then((r) => r.json()),
                    fetch("/api/stats/payouts").then((r) => r.json()),
                ]);
                setStats({
                    traders: live.walletsTraded ?? live.tradersAllTime ?? 0,
                    volume: live.totalVolume ?? 0,
                    fees: live.totalFees ?? 0,
                    paid: payouts.totalPaidUsd ?? live.referralPaidUsd ?? 0,
                });
            } catch {
                /* ignore */
            }
        };
        load();
        const i = setInterval(load, 20_000);
        window.addEventListener("shx-swap-success", () => setTimeout(load, 6000));
        return () => {
            clearInterval(i);
            window.removeEventListener("shx-swap-success", () => {});
        };
    }, []);

    const fmt = (n: number) => {
        if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
        if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
        return `$${n.toFixed(0)}`;
    };

    return (
        <div className="border-b border-white/5 bg-black/70 backdrop-blur-xl">
            <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-1.5 flex items-center gap-3 md:gap-6 overflow-x-auto scrollbar-hide text-[10px] md:text-[11px]">
                <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                    </span>
                    <Shield size={11} className="text-primary" />
                    <span className="font-bold text-white/80">Live ledger</span>
                </div>

                <Stat icon={Users} label="Wallets traded" value={stats.traders.toLocaleString()} />
                <Stat icon={DollarSign} label="Volume" value={fmt(stats.volume)} />
                <Stat icon={Sparkles} label="Fees" value={fmt(stats.fees)} />
                <Stat
                    icon={Banknote}
                    label="USDC paid"
                    value={fmt(stats.paid)}
                    highlight
                />

                <Link
                    href="/referrals"
                    className="ml-auto shrink-0 text-emerald-400 font-bold hover:underline"
                >
                    Earn USDC →
                </Link>
                <Link
                    href={`/?focus=shx`}
                    className="shrink-0 px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary font-black"
                >
                    Buy SHX 0%
                </Link>
            </div>
        </div>
    );
}

function Stat({
    icon: Icon,
    label,
    value,
    highlight,
}: {
    icon: typeof Users;
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className="flex items-center gap-1.5 shrink-0 font-mono">
            <Icon size={11} className={highlight ? "text-green-400" : "text-muted-foreground"} />
            <span className="text-muted-foreground hidden sm:inline">{label}</span>
            <span className={`font-bold ${highlight ? "text-green-400" : "text-white"}`}>
                {value}
            </span>
        </div>
    );
}
