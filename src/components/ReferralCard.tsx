"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import {
    Users, Copy, Check, Gift, Zap, Crown, TrendingUp,
    Share2, ExternalLink, Loader2, Sparkles,
} from "lucide-react";

interface ReferralStats {
    referralCode: string;
    referralCount: number;
    referralEarnings: number;
    referralClaimableUsd: number;
    referralVolumeGenerated: number;
    referralCashbackEarned: number;
    feeSharePercent: number;
    referredBy: string | null;
    affiliateTier: {
        tier: { label: string; feeShare: number; color: string; minRefs: number };
        next: { label: string; minRefs: number } | null;
        progress: number;
    };
    config?: {
        headline: string;
        subhead: string;
        signupBonusReferrerXp: number;
        signupBonusRefereeXp: number;
        refereeCashbackShare: number;
        refereeXpMultiplier: number;
        l2FeeShare: number;
        milestones: { volumeUsd: number; bonusXp: number; bonusUsd: number }[];
        affiliateTiers: { minRefs: number; feeShare: number; label: string; color: string }[];
    };
    topReferrals?: { wallet: string; volume: number; tradeCount: number }[];
    recentEvents?: { type: string; l1Usd?: number; volumeUsd?: number; createdAt?: string }[];
}

export function ReferralCard({ compact = false }: { compact?: boolean }) {
    const { publicKey, connected } = useWallet();
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState<"link" | "code" | null>(null);

    const load = useCallback(async () => {
        if (!publicKey) return;
        setLoading(true);
        const wallet = publicKey.toString();
        try {
            await fetch("/api/referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "init", wallet }),
            });
            const res = await fetch("/api/referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "stats", wallet }),
            });
            const data = await res.json();
            setStats(data);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [publicKey]);

    useEffect(() => {
        load();
        const onSwap = () => setTimeout(load, 8000);
        window.addEventListener("shx-swap-success", onSwap);
        return () => window.removeEventListener("shx-swap-success", onSwap);
    }, [load]);

    const link =
        typeof window !== "undefined" && stats?.referralCode
            ? `${window.location.origin}?ref=${stats.referralCode}`
            : stats?.referralCode
              ? `https://shx.exchange?ref=${stats.referralCode}`
              : "";

    const copy = async (kind: "link" | "code") => {
        if (!stats?.referralCode) return;
        const text = kind === "link" ? link : stats.referralCode;
        await navigator.clipboard.writeText(text);
        setCopied(kind);
        setTimeout(() => setCopied(null), 2000);
    };

    const share = async () => {
        if (!link) return;
        const text = `Trade on SHX Exchange — I get paid when you trade. You get 1.5× XP + fee cashback. ${link}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: "SHX Referral", text, url: link });
                return;
            } catch {
                /* fall through */
            }
        }
        await copy("link");
    };

    if (!connected) {
        return (
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-black/60 to-purple-500/10 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-2">
                    <Gift className="text-primary" size={18} />
                    <h4 className="text-sm font-black text-white">Earn up to 65% forever</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    Connect your wallet to unlock lifetime fee rev-share on every trader you invite.
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                        { v: "50–65%", l: "Fee share" },
                        { v: "1.5×", l: "Friend XP" },
                        { v: "15%", l: "Their cashback" },
                    ].map((x) => (
                        <div key={x.l} className="rounded-lg bg-black/40 border border-white/5 p-2">
                            <div className="text-sm font-black text-primary">{x.v}</div>
                            <div className="text-[9px] text-muted-foreground uppercase">{x.l}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (loading && !stats) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-8 flex justify-center">
                <Loader2 className="animate-spin text-primary" size={24} />
            </div>
        );
    }

    const tier = stats?.affiliateTier?.tier;
    const next = stats?.affiliateTier?.next;
    const progress = stats?.affiliateTier?.progress ?? 0;

    return (
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-black/70 to-emerald-500/5 backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/5">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles size={16} className="text-primary" />
                            <h4 className="text-sm font-black text-white">Referral Empire</h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug max-w-sm">
                            {stats?.config?.headline ||
                                "Earn up to 65% of every fee your network pays — forever"}
                        </p>
                    </div>
                    {tier && (
                        <div
                            className="px-2.5 py-1 rounded-full text-[10px] font-black border"
                            style={{
                                color: tier.color,
                                borderColor: `${tier.color}55`,
                                background: `${tier.color}15`,
                            }}
                        >
                            <Crown size={10} className="inline mr-1" />
                            {tier.label} · {Math.round(tier.feeShare * 100)}%
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Big stats */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-black/50 border border-white/5 p-3">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">
                            Claimable credits
                        </div>
                        <div className="text-2xl font-black text-green-400 font-mono">
                            ${(stats?.referralClaimableUsd ?? stats?.referralEarnings ?? 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                            Lifetime: ${(stats?.referralEarnings ?? 0).toFixed(2)}
                        </div>
                    </div>
                    <div className="rounded-xl bg-black/50 border border-white/5 p-3">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">
                            Network volume
                        </div>
                        <div className="text-2xl font-black text-white font-mono">
                            ${formatCompact(stats?.referralVolumeGenerated || 0)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                            {stats?.referralCount || 0} traders invited
                        </div>
                    </div>
                </div>

                {!compact && (
                    <div className="grid grid-cols-3 gap-2">
                        <MiniStat
                            icon={Zap}
                            label="Your cut"
                            value={`${stats?.feeSharePercent ?? 50}%`}
                            color="text-primary"
                        />
                        <MiniStat
                            icon={Gift}
                            label="Friend cashback"
                            value="15%"
                            color="text-emerald-400"
                        />
                        <MiniStat
                            icon={TrendingUp}
                            label="Friend XP"
                            value="1.5×"
                            color="text-yellow-400"
                        />
                    </div>
                )}

                {/* Tier progress */}
                {next && (
                    <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>
                                Next: {next.label} ({next.minRefs} refs)
                            </span>
                            <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Link */}
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                        Your invite link
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0 bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-xs text-primary truncate">
                            {stats?.referralCode ? `?ref=${stats.referralCode}` : "…"}
                        </div>
                        <button
                            type="button"
                            onClick={() => copy("link")}
                            className="px-3 rounded-xl bg-primary text-black font-bold text-xs flex items-center gap-1.5 hover:opacity-90"
                        >
                            {copied === "link" ? <Check size={14} /> : <Copy size={14} />}
                            {copied === "link" ? "Copied" : "Copy"}
                        </button>
                        <button
                            type="button"
                            onClick={share}
                            className="px-3 rounded-xl bg-white/10 border border-white/15 text-white font-bold text-xs flex items-center gap-1 hover:bg-white/15"
                            title="Share"
                        >
                            <Share2 size={14} />
                        </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                        Signup: +{stats?.config?.signupBonusReferrerXp ?? 1500} XP for you · +
                        {stats?.config?.signupBonusRefereeXp ?? 750} XP for them
                    </p>
                </div>

                {/* Why it's good */}
                {!compact && (
                    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-1.5">
                        <div className="text-[11px] font-bold text-green-400 flex items-center gap-1">
                            <Users size={12} /> Why people click
                        </div>
                        <ul className="text-[11px] text-muted-foreground space-y-1">
                            <li>• They keep 15% of platform fees as cashback credit</li>
                            <li>• 1.5× XP on every trade (leaderboard rocket fuel)</li>
                            <li>• You earn 50–65% of their fees for life + L2 overrides</li>
                            <li>
                                • Volume milestones: up to $200 + 75k XP per whale invite
                            </li>
                        </ul>
                    </div>
                )}

                {/* Top invites */}
                {!compact && stats?.topReferrals && stats.topReferrals.length > 0 && (
                    <div>
                        <div className="text-[10px] uppercase text-muted-foreground mb-2">
                            Your top traders
                        </div>
                        <div className="space-y-1.5">
                            {stats.topReferrals.slice(0, 5).map((r) => (
                                <div
                                    key={r.wallet}
                                    className="flex items-center justify-between text-xs bg-white/[0.03] rounded-lg px-2.5 py-1.5"
                                >
                                    <span className="font-mono text-muted-foreground">
                                        {r.wallet.slice(0, 4)}…{r.wallet.slice(-4)}
                                    </span>
                                    <span className="text-white font-bold">
                                        ${formatCompact(r.volume)} · {r.tradeCount} tx
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <Link
                    href="/referrals"
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                    Full referral dashboard <ExternalLink size={12} />
                </Link>
            </div>
        </div>
    );
}

function MiniStat({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: typeof Zap;
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div className="rounded-lg bg-black/40 border border-white/5 p-2 text-center">
            <Icon size={12} className={`${color} mx-auto mb-1`} />
            <div className={`text-sm font-black ${color}`}>{value}</div>
            <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
        </div>
    );
}

function formatCompact(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
}
