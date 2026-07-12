"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ReferralCard } from "@/components/ReferralCard";
import { ShareCard } from "@/components/ShareCard";
import {
    Trophy, Gift, Users, Zap, TrendingUp, Layers, Crown, Loader2,
} from "lucide-react";
import { REFERRAL_CONFIG } from "@/lib/referralConfig";

interface Leader {
    rank: number;
    wallet: string;
    referralCount: number;
    referralEarnings: number;
    referralVolumeGenerated: number;
    tier: string;
}

export default function ReferralsPage() {
    const { connected, publicKey } = useWallet();
    const [leaders, setLeaders] = useState<Leader[]>([]);
    const [loading, setLoading] = useState(true);
    const [refCode, setRefCode] = useState("");

    useEffect(() => {
        fetch("/api/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "leaderboard" }),
        })
            .then((r) => r.json())
            .then((d) => setLeaders(d.leaders || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!publicKey) return;
        const wallet = publicKey.toString();
        fetch("/api/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "init", wallet }),
        })
            .then((r) => r.json())
            .then((d) => setRefCode(d.referralCode || ""))
            .catch(() => {});
    }, [publicKey]);

    return (
        <main className="min-h-screen bg-background relative overflow-hidden pb-20">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/15 blur-[160px] rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-6xl mx-auto px-4 pt-8 md:pt-12">
                {/* Hero */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold mb-4">
                        <Gift size={12} /> LIFETIME REV-SHARE
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight">
                        Get paid in{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">
                            USDC
                        </span>{" "}
                        for real volume
                    </h1>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
                        {REFERRAL_CONFIG.subhead}
                    </p>
                </div>

                {/* Economics grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                    {[
                        {
                            icon: Zap,
                            title: "25–35%",
                            sub: "of platform fees (L1)",
                            color: "text-primary",
                        },
                        {
                            icon: Layers,
                            title: `$${REFERRAL_CONFIG.minQualifyingVolumeUsd}+`,
                            sub: "min invitee volume",
                            color: "text-cyan-400",
                        },
                        {
                            icon: Gift,
                            title: `$${REFERRAL_CONFIG.minPayoutUsd}`,
                            sub: "auto USDC payout",
                            color: "text-emerald-400",
                        },
                        {
                            icon: TrendingUp,
                            title: "5% L2",
                            sub: "+ 5% friend cashback",
                            color: "text-yellow-400",
                        },
                    ].map((c) => (
                        <div
                            key={c.title}
                            className="rounded-2xl border border-white/10 bg-black/50 p-4 text-center"
                        >
                            <c.icon size={18} className={`${c.color} mx-auto mb-2`} />
                            <div className={`text-xl font-black ${c.color}`}>{c.title}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</div>
                        </div>
                    ))}
                </div>

                <div className="grid lg:grid-cols-12 gap-6">
                    {/* Main card */}
                    <div className="lg:col-span-5 space-y-4">
                        <ReferralCard />
                        <ShareCard kind="referral" referralCode={refCode} />
                    </div>

                    {/* Tiers + milestones */}
                    <div className="lg:col-span-7 space-y-6">
                        <section className="rounded-2xl border border-white/10 bg-black/50 p-5">
                            <h2 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                                <Crown size={16} className="text-yellow-400" /> Affiliate tiers
                            </h2>
                            <div className="space-y-2">
                                {REFERRAL_CONFIG.affiliateTiers.map((t) => (
                                    <div
                                        key={t.label}
                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ background: t.color }}
                                            />
                                            <span className="text-sm font-bold text-white">
                                                {t.label}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {t.minRefs}+ invites
                                            </span>
                                        </div>
                                        <span className="font-mono font-black text-primary">
                                            {Math.round(t.feeShare * 100)}% fees
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-white/10 bg-black/50 p-5">
                            <h2 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-400" /> Volume
                                milestones (per invite)
                            </h2>
                            <div className="grid grid-cols-2 gap-2">
                                {REFERRAL_CONFIG.milestones.map((m) => (
                                    <div
                                        key={m.volumeUsd}
                                        className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                                    >
                                        <div className="text-xs text-muted-foreground">
                                            When they hit ${m.volumeUsd.toLocaleString()} vol
                                        </div>
                                        <div className="text-sm font-black text-white mt-1">
                                            +${m.bonusUsd} · {m.bonusXp.toLocaleString()} XP
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-white/10 bg-black/50 p-5">
                            <h2 className="text-sm font-black text-white mb-4 flex items-center gap-2">
                                <Trophy size={16} className="text-yellow-500" /> Top referrers
                            </h2>
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin text-primary" />
                                </div>
                            ) : leaders.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">
                                    Be the first to climb the board — share your link.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {leaders.map((l) => (
                                        <div
                                            key={l.wallet}
                                            className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5"
                                        >
                                            <span
                                                className={`w-6 text-center font-black text-xs ${
                                                    l.rank <= 3 ? "text-yellow-400" : "text-muted-foreground"
                                                }`}
                                            >
                                                #{l.rank}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-mono text-xs text-white truncate">
                                                    {l.wallet.slice(0, 6)}…{l.wallet.slice(-4)}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {l.referralCount} invites · {l.tier}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-black text-green-400">
                                                    ${l.referralEarnings.toFixed(2)}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    ${formatVol(l.referralVolumeGenerated)} vol
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                </div>

                {/* How it works */}
                <section className="mt-10 rounded-2xl border border-white/10 bg-black/40 p-6">
                    <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                        <Users size={18} className="text-primary" /> How it works
                    </h2>
                    <ol className="grid md:grid-cols-4 gap-4">
                        {[
                            {
                                n: "1",
                                t: "Share your link",
                                d: "Copy from the card — Twitter, Telegram, Discord, DMs.",
                            },
                            {
                                n: "2",
                                t: "They connect",
                                d: `XP only at signup (+${REFERRAL_CONFIG.signupBonusReferrerXp} / +${REFERRAL_CONFIG.signupBonusRefereeXp}). No fee share yet.`,
                            },
                            {
                                n: "3",
                                t: "They qualify",
                                d: `After $${REFERRAL_CONFIG.minQualifyingVolumeUsd}+ volume and ${REFERRAL_CONFIG.minQualifyingTrades}+ trades, fee share starts.`,
                            },
                            {
                                n: "4",
                                t: "Auto USDC",
                                d: `Claimable ≥ $${REFERRAL_CONFIG.minPayoutUsd} → automatic USDC to their wallet (hourly cron + on-credit).`,
                            },
                        ].map((s) => (
                            <div key={s.n} className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                                <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary font-black text-sm flex items-center justify-center mb-2">
                                    {s.n}
                                </div>
                                <div className="text-sm font-bold text-white mb-1">{s.t}</div>
                                <div className="text-xs text-muted-foreground">{s.d}</div>
                            </div>
                        ))}
                    </ol>
                    {!connected && (
                        <p className="text-center text-xs text-muted-foreground mt-6">
                            Connect a wallet on this page to generate your personal code.
                        </p>
                    )}
                </section>
            </div>
        </main>
    );
}

function formatVol(n: number) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toFixed(0);
}
