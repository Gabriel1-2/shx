"use client";

import { useEffect, useState, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getUserStats, getLeaderboard } from "@/lib/points";
import { getCurrentTier, checkMilestoneEligibility, HOLDER_FEE_TIERS } from "@/lib/feeTiers";
import { getShulevitzHoldingsUSD } from "@/lib/tokenBalance";
import { getPlatformStats } from "@/lib/platformStats";
import { Leaderboard } from "@/components/Leaderboard";
import { SystemStatus } from "@/components/SystemStatus";
import { ReferralCard } from "@/components/ReferralCard";
import { MarketWatch } from "@/components/MarketWatch";
import { TransactionHistory } from "@/components/TransactionHistory";
import { AnimatedCurrency, AnimatedCounter } from "@/components/AnimatedCounter";
import { useReferralCapture } from "@/hooks/useReferralCapture";
import {
    TrendingUp, Shield, AlertTriangle, Zap, Wallet, Trophy, Activity,
    ChevronRight, Sparkles, Target, Award
} from "lucide-react";

function DashboardContent() {
    const { publicKey } = useWallet();
    useReferralCapture();

    const [stats, setStats] = useState({
        totalTrades: 0,
        totalVolume: 0,
        totalPoints: 0,
        tradeCount: 0,
        totalFeesPaid: 0
    });
    const [platformStats, setPlatformStats] = useState({
        totalVolume: 0,
        totalTrades: 0,
        totalUsers: 0,
        totalFees: 0
    });
    const [holdingsUSD, setHoldingsUSD] = useState(0);
    const [tierInfo, setTierInfo] = useState<ReturnType<typeof getCurrentTier> | null>(null);
    const [userRank, setUserRank] = useState<number | null>(null);
    const [milestoneStatus, setMilestoneStatus] = useState<ReturnType<typeof checkMilestoneEligibility> | null>(null);

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
                    totalFeesPaid: data.totalFeesPaid || 0
                });

                getLeaderboard().then(leaderboard => {
                    const entry = leaderboard.find(e => e.wallet === walletAddr);
                    if (entry) {
                        setUserRank(entry.rank);
                        setMilestoneStatus(checkMilestoneEligibility(
                            entry.rank,
                            data.volume || 0,
                            data.tradeCount || 0,
                            data.totalFeesPaid || 0
                        ));
                    }
                });
            });

            getShulevitzHoldingsUSD(walletAddr).then(holdings => {
                setHoldingsUSD(holdings);
                setTierInfo(getCurrentTier(holdings));
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
                <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
                                <Trophy className="text-primary" size={24} />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-lime-400 to-green-500">
                                TRADER DASHBOARD
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground">Track your performance, rewards, and climb the leaderboard</p>
                    </div>
                    {publicKey && (
                        <div className="flex items-center gap-3">
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
                    {/* Left Column - Personal Stats */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Fee Tier Card */}
                        {publicKey && tierInfo && (
                            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-black/40 to-emerald-500/5 p-6 backdrop-blur-xl">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-primary/20">
                                            <Sparkles className="text-primary" size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-white">Your Fee Tier</h2>
                                            <p className="text-xs text-muted-foreground">Hold $SHULEVITZ for lower fees</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-primary">{(tierInfo.current.feeBps / 100).toFixed(2)}%</div>
                                        <div className="text-xs text-green-400 font-bold">{tierInfo.current.discount}</div>
                                    </div>
                                </div>

                                <div className="grid gap-4 grid-cols-3">
                                    <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
                                        <div className="text-[10px] text-muted-foreground mb-1">Holdings</div>
                                        <div className="text-lg font-bold text-white">${holdingsUSD.toLocaleString()}</div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
                                        <div className="text-[10px] text-muted-foreground mb-1">Current Fee</div>
                                        <div className="text-lg font-bold text-primary">{(tierInfo.current.feeBps / 100).toFixed(2)}%</div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
                                        <div className="text-[10px] text-muted-foreground mb-1">Discount</div>
                                        <div className="text-lg font-bold text-green-400">{tierInfo.current.discount}</div>
                                    </div>
                                </div>

                                {tierInfo.next && (
                                    <div className="mt-4">
                                        <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                            <span>Next: ${tierInfo.next.minHoldingsUSD.toLocaleString()} ({(tierInfo.next.feeBps / 100).toFixed(2)}%)</span>
                                            <span className="text-primary font-bold">{tierInfo.progressToNext}%</span>
                                        </div>
                                        <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary to-lime-400 transition-all duration-500"
                                                style={{ width: `${tierInfo.progressToNext}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Your Stats */}
                        <div>
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Target size={18} className="text-primary" />
                                Your Performance
                            </h2>
                            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                                {[
                                    { label: "Volume", value: formatNumber(stats.totalVolume), color: "text-white" },
                                    { label: "Trades", value: stats.tradeCount.toString(), color: "text-white" },
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

                        {/* Milestone Status */}
                        {userRank && userRank <= 10 && milestoneStatus && (
                            <div className={`rounded-2xl border p-5 backdrop-blur-xl ${milestoneStatus.eligible
                                ? 'border-green-500/30 bg-green-500/5'
                                : 'border-yellow-500/30 bg-yellow-500/5'
                                }`}>
                                <div className="flex items-center gap-3">
                                    {milestoneStatus.eligible ? (
                                        <div className="p-2 rounded-xl bg-green-500/20">
                                            <Shield className="text-green-400" size={20} />
                                        </div>
                                    ) : (
                                        <div className="p-2 rounded-xl bg-yellow-500/20">
                                            <AlertTriangle className="text-yellow-400" size={20} />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <span className="font-bold text-white">Rank #{userRank} Status</span>
                                        {milestoneStatus.eligible ? (
                                            <p className="text-sm text-green-400 mt-1">
                                                ✅ Eligible for ${milestoneStatus.reward} + {(milestoneStatus.nextDayFee! / 100).toFixed(2)}% fee tomorrow
                                            </p>
                                        ) : (
                                            <p className="text-sm text-yellow-400 mt-1">{milestoneStatus.reason}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Transaction History */}
                        <TransactionHistory />

                        {/* Leaderboard */}
                        <div>
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Trophy size={18} className="text-yellow-500" />
                                Global Leaderboard
                            </h2>
                            <Leaderboard userScore={stats.totalPoints} />
                        </div>
                    </div>

                    {/* Right Column - Sidebar */}
                    <div className="space-y-4">
                        <MarketWatch />
                        <ReferralCard />
                        <SystemStatus />

                        {/* Eligibility Info */}
                        <div className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl p-4">
                            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                <Shield size={14} className="text-primary" />
                                Reward Eligibility
                            </h4>
                            <div className="space-y-2 text-xs text-muted-foreground">
                                <p className="flex items-center gap-2">
                                    <ChevronRight size={12} className="text-primary" />
                                    Min 5 trades required
                                </p>
                                <p className="flex items-center gap-2">
                                    <ChevronRight size={12} className="text-primary" />
                                    Min $25 in fees paid
                                </p>
                                <p className="flex items-center gap-2">
                                    <ChevronRight size={12} className="text-primary" />
                                    No wash trading
                                </p>
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
