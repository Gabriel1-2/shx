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
import { ReferralCard } from "@/components/ReferralCard";
import { LiveTradersTracker } from "@/components/LiveTradersTracker";
import { PortfolioCard } from "@/components/PortfolioCard";
import { SavingsCalculator } from "@/components/SavingsCalculator";
import { QualifyProgress } from "@/components/QualifyProgress";
import { PayoutsFeed } from "@/components/PayoutsFeed";
import { ShareCard } from "@/components/ShareCard";
import { useSHXTier } from "@/hooks/useSHXTier";
import { FEE_TIERS } from "@/lib/feeTiers";

import {
    TrendingUp, Shield, Zap, Wallet, Trophy, Activity,
    ChevronRight, Target, Award, Coins, ArrowUp,
    BarChart2, Layers, DollarSign, ListOrdered
} from "lucide-react";
import dynamic from "next/dynamic";

const OrdersPanel = dynamic(() => import("@/components/OrdersPanel"), {
    ssr: false,
    loading: () => <div className="w-full h-[300px] bg-white/5 animate-pulse rounded-2xl" />
});

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
        dailyVolume: 0,
    });
    const [platformStats, setPlatformStats] = useState({
        totalVolume: 0,
        totalTrades: 0,
        totalUsers: 0,
        totalFees: 0,
        dailyVolume: 0,
        dailyTrades: 0,
        dailyFees: 0,
    });
    const [userRank, setUserRank] = useState<number | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchStats = () => {
            getPlatformStats().then(data => {
                if (isMounted) setPlatformStats(data);
            });

            if (publicKey) {
                const walletAddr = publicKey.toString();
                getUserStats(walletAddr).then(data => {
                    if (!isMounted) return;
                    
                    // Daily Volume 24hr Reset Enforcer (Visual)
                    // If the dayStart in data doesn't match current UTC day, visually force it to 0
                    const now = new Date();
                    const currentDay = now.toISOString().split("T")[0];
                    let dailyVol = data.dailyVolume || 0;
                    if ((data as any).dayStart && (data as any).dayStart !== currentDay) {
                        dailyVol = 0; 
                    }

                    setStats({
                        totalTrades: data.tradeCount || 0,
                        totalVolume: data.volume || 0,
                        totalPoints: data.points || 0,
                        tradeCount: data.tradeCount || 0,
                        totalFeesPaid: data.totalFeesPaid || 0,
                        weeklyVolume: data.weeklyVolume || 0,
                        dailyVolume: dailyVol,
                    });

                    getWeeklyLeaderboard().then(leaderboard => {
                        if (!isMounted) return;
                        const entry = leaderboard.find(e => e.wallet === walletAddr);
                        if (entry) {
                            setUserRank(entry.rank);
                        }
                    });
                });
            }
        };

        fetchStats(); // initial fetch

        // Live refresh every 15 seconds
        const interval = setInterval(fetchStats, 15000);

        // Listen for swap success events and refresh after a delay
        // (the backend takes ~4-20s to confirm the tx on-chain and write to Firestore)
        const handleSwapSuccess = () => {
            // First refresh after 5s (optimistic — backend may still be processing)
            setTimeout(fetchStats, 5000);
            // Second refresh after 15s (should definitely be written by now)
            setTimeout(fetchStats, 15000);
            // Third refresh after 25s (final catch-all for slow RPC confirmations)
            setTimeout(fetchStats, 25000);
        };

        window.addEventListener("shx-swap-success", handleSwapSuccess);

        return () => {
            isMounted = false;
            clearInterval(interval);
            window.removeEventListener("shx-swap-success", handleSwapSuccess);
        };
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
                <div className="mb-4">
                    <QualifyProgress />
                </div>
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

                        {/* Daily Volume */}
                        <div className="group relative rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-yellow-500/20 transition-all">
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <BarChart2 size={16} className="text-yellow-400" />
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Today&apos;s Volume</span>
                                </div>
                                <div className="text-2xl font-bold text-white mb-1">
                                    {formatNumber(stats.dailyVolume)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Resets at 12:00 AM UTC
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Platform Stats */}
                <div className="mb-8 grid gap-3 grid-cols-2 lg:grid-cols-5">
                    {[
                        { label: "24h Volume", value: platformStats.dailyVolume, isCurrency: true, icon: Activity, gradient: "from-blue-500 to-cyan-500" },
                        { label: "24h Fees", value: platformStats.dailyFees, isCurrency: true, icon: DollarSign, gradient: "from-yellow-500 to-orange-500" },
                        { label: "24h Trades", value: platformStats.dailyTrades, isCurrency: false, icon: Zap, gradient: "from-purple-500 to-pink-500" },
                        { label: "All-Time Vol", value: platformStats.totalVolume, isCurrency: true, icon: TrendingUp, gradient: "from-green-500 to-emerald-500" },
                        { label: "All-Time Fees", value: platformStats.totalFees, isCurrency: true, icon: Coins, gradient: "from-amber-400 to-orange-500" },
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

                        {/* Active Orders */}
                        {publicKey && (
                            <div>
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 mt-8">
                                    <ListOrdered size={18} className="text-primary" />
                                    Active Orders
                                </h2>
                                <OrdersPanel />
                            </div>
                        )}

                        {/* Transaction History */}
                        <div className="mt-8">
                            <TransactionHistory />
                        </div>

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
                        <LiveTradersTracker />

                        <PortfolioCard />

                        <SavingsCalculator />

                        <PayoutsFeed />

                        <MarketWatch />

                        <ReferralCard />

                        {publicKey && (
                            <ShareCard
                                kind="stats"
                                volume={stats.totalVolume}
                                points={stats.totalPoints}
                                tierLabel={tierData.label}
                            />
                        )}

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
