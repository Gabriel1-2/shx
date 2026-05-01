"use client";

import { useEffect, useState, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getUserStats, getWeeklyLeaderboard } from "@/lib/points";
import { getPlatformStats } from "@/lib/platformStats";
import { Leaderboard } from "@/components/Leaderboard";
import { SystemStatus } from "@/components/SystemStatus";

import { MarketWatch } from "@/components/MarketWatch";
import { TransactionHistory } from "@/components/TransactionHistory";
import { AnimatedCurrency, AnimatedCounter } from "@/components/AnimatedCounter";
import { TierBadge } from "@/components/TierBadge";
import { useSHXTier } from "@/hooks/useSHXTier";
import { FEE_TIERS } from "@/lib/feeTiers";

import {
    TrendingUp, Shield, Zap, Wallet, Trophy, Activity,
    ChevronRight, Target, Award, Coins, ArrowUp,
    BarChart2, Layers
} from "lucide-react";

function DashboardContent() {
    const { publicKey } = useWallet();


    const tierData = useSHXTier();

    const [stats, setStats] = useState({
        totalTrades: 0,
        totalVolume: 0,
        totalPoints: 0,
        tradeCount: 0,
        totalFeesPaid: 0,
        weeklyVolume: 0,
    });
    const [platformStats, setPlatformStats] = useState({
        totalVolume: 0,
        totalTrades: 0,
        totalUsers: 0,
        totalFees: 0
    });
    const [userRank, setUserRank] = useState<number | null>(null);

    useEffect(() => {
        getPlatformStats().then(setPlatformStats);
    }, []);

    useEffect(() => {
        if (publicKey) {
            const walletAddr = publicKey.toString();

            getUserStats(walletAddr).then(data => {
                setStats({
                    totalTrades: data.tradeCount || 0,
                    totalVolume: data.volume || 0,
                    totalPoints: data.points || 0,
                    tradeCount: data.tradeCount || 0,
                    totalFeesPaid: data.totalFeesPaid || 0,
                    weeklyVolume: data.weeklyVolume || 0,
                });

                getWeeklyLeaderboard().then(leaderboard => {
                    const entry = leaderboard.find(e => e.wallet === walletAddr);
                    if (entry) {
                        setUserRank(entry.rank);
                    }
                });
            });
        }
    }, [publicKey]);

    const formatNumber = (num: number) => {
        if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
        if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
        return `$${num.toFixed(0)}`;
    };

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/15 blur-[200px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-30%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[180px] rounded-full"></div>
                <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[150px] rounded-full"></div>
            </div>

            <div className="relative z-10 container mx-auto p-4 md:p-6 lg:p-8">
                {/* Hero Header */}
                <div className="mb-6 md:mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 md:gap-3 mb-1">
                            <div className="p-1.5 md:p-2 rounded-xl bg-primary/20 border border-primary/30">
                                <Trophy className="text-primary" size={20} />
                            </div>
                            <h1 className="text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-lime-400 to-green-500">
                                TRADER DASHBOARD
                            </h1>
                        </div>
                        <p className="text-xs md:text-sm text-muted-foreground">Track your performance, tier status, and climb the leaderboard</p>
                    </div>
                    {publicKey && (
                        <div className="flex items-center gap-3">
                            <TierBadge tier={tierData.tier} size="md" showFee />
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/60 border border-white/10 backdrop-blur-xl">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-xs text-muted-foreground font-mono">
                                    {publicKey.toString().slice(0, 6)}...{publicKey.toString().slice(-4)}
                                </span>
                            </div>
                            {userRank && userRank <= 10 && (
                                <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                                    <Award size={14} className="text-yellow-500" />
                                    <span className="text-xs font-bold text-yellow-500">#{userRank}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── SHX HOLDINGS + TIER STATUS ─── */}
                {publicKey && (
                    <div className="mb-8 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                        {/* SHX Holdings */}
                        <div className="group relative rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-green-500/20 transition-all">
                            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <Coins size={16} className="text-green-400" />
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SHX Holdings</span>
                                </div>
                                <div className="text-2xl font-bold text-white mb-1">
                                    {tierData.loading ? "..." : tierData.shxBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    ≈ ${tierData.shxValueUSD.toFixed(2)} USD
                                </div>
                            </div>
                        </div>

                        {/* Fee Tier */}
                        <div className="group relative rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-purple-500/20 transition-all">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <Layers size={16} className="text-purple-400" />
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Fee Tier</span>
                                </div>
                                <div className="flex items-center gap-3 mb-1">
                                    <TierBadge tier={tierData.tier} size="lg" />
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Your fee: <span className="text-white font-bold">{tierData.feePercent}%</span>
                                    {tierData.feeBps < FEE_TIERS[0].feeBps && (
                                        <span className="text-green-400 ml-2">
                                            (saving {(FEE_TIERS[0].feePercent - tierData.feePercent).toFixed(2)}%)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Progress to Next Tier */}
                        <div className="group relative rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-cyan-500/20 transition-all">
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <ArrowUp size={16} className="text-cyan-400" />
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Next Tier</span>
                                </div>
                                {tierData.nextTier ? (
                                    <>
                                        <div className="text-lg font-bold text-white mb-2">
                                            {tierData.shxNeeded.toLocaleString(undefined, { maximumFractionDigits: 0 })} SHX needed
                                        </div>
                                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-1">
                                            <div
                                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                                                style={{ width: `${tierData.progress}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                            <span>{tierData.progress.toFixed(0)}%</span>
                                            <span>{tierData.nextTier.label} → {tierData.nextTier.feePercent}%</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-lg font-bold text-purple-400">
                                        ✨ Max Tier Reached!
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Weekly Volume */}
                        <div className="group relative rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-yellow-500/20 transition-all">
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <BarChart2 size={16} className="text-yellow-400" />
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Weekly Volume</span>
                                </div>
                                <div className="text-2xl font-bold text-white mb-1">
                                    {formatNumber(stats.weeklyVolume)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {userRank && userRank <= 10 ? (
                                        <span className="text-yellow-400 font-bold">Ranked #{userRank} this week 🏆</span>
                                    ) : stats.weeklyVolume >= 1000 ? (
                                        <span className="text-green-400">Qualifying for rewards</span>
                                    ) : (
                                        <span>${(1000 - stats.weeklyVolume).toFixed(0)} more to qualify</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Platform Stats */}
                <div className="mb-8 grid gap-3 grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: "Platform Volume", value: platformStats.totalVolume, isCurrency: true, icon: Activity, gradient: "from-blue-500 to-cyan-500" },
                        { label: "Active Traders", value: platformStats.totalUsers, isCurrency: false, icon: Wallet, gradient: "from-purple-500 to-pink-500" },
                        { label: "Total Swaps", value: platformStats.totalTrades, isCurrency: false, icon: Zap, gradient: "from-yellow-500 to-orange-500" },
                        { label: "Fees Collected", value: platformStats.totalFees, isCurrency: true, icon: TrendingUp, gradient: "from-green-500 to-emerald-500" },
                    ].map((stat, i) => (
                        <div key={i} className="group relative rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl p-4 hover:border-white/10 transition-all duration-300 hover:scale-[1.02]">
                            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity`}></div>
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`p-1.5 rounded-lg bg-gradient-to-br ${stat.gradient} bg-opacity-20`}>
                                        <stat.icon size={12} className="text-white" />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    {stat.isCurrency ? (
                                        <AnimatedCurrency value={stat.value} />
                                    ) : (
                                        <AnimatedCounter value={stat.value} />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Grid */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Your Performance Stats */}
                        <div>
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Target size={18} className="text-primary" />
                                Your Performance
                            </h2>
                            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                                {[
                                    { label: "Total Volume", value: formatNumber(stats.totalVolume), color: "text-white" },
                                    { label: "Total Trades", value: stats.tradeCount.toString(), color: "text-white" },
                                    { label: "Fees Paid", value: formatNumber(stats.totalFeesPaid), color: "text-white" },
                                    { label: "XP Earned", value: stats.totalPoints.toLocaleString(), color: "text-primary" },
                                ].map((stat, i) => (
                                    <div key={i} className="rounded-xl border border-white/5 bg-black/40 backdrop-blur-xl p-4 hover:border-white/10 transition-colors">
                                        <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{stat.label}</div>
                                        <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Transaction History */}
                        <TransactionHistory />

                        {/* Leaderboard */}
                        <div>
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Trophy size={18} className="text-yellow-500" />
                                Weekly Leaderboard
                            </h2>
                            <Leaderboard />
                        </div>
                    </div>

                    {/* Right Column - Sidebar */}
                    <div className="space-y-4">
                        <MarketWatch />

                        <SystemStatus />

                        {/* Fee Tier Table */}
                        <div className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl p-4">
                            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                <Shield size={14} className="text-primary" />
                                Fee Tiers
                            </h4>
                            <div className="space-y-1.5">
                                {FEE_TIERS.map((t) => (
                                    <div
                                        key={t.tier}
                                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${publicKey && tierData.tier.tier === t.tier
                                                ? "bg-primary/10 border border-primary/30"
                                                : "bg-white/5"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                                            <span className="font-bold text-white">{t.label}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-muted-foreground">
                                            <span>{t.minSHX.toLocaleString()} SHX</span>
                                            <span className="font-bold text-white">{t.feePercent}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                                <span className="text-[11px] text-green-400 font-bold">
                                    🔥 0% fee when buying SHX!
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <DashboardContent />
        </Suspense>
    );
}
