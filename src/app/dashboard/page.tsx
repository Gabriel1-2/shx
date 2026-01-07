"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getUserStats, getLeaderboard, LeaderboardEntry } from "@/lib/points";
import { getCurrentTier, checkMilestoneEligibility, HOLDER_FEE_TIERS } from "@/lib/feeTiers";
import { getShulevitzHoldingsUSD } from "@/lib/tokenBalance";
import { Leaderboard } from "@/components/Leaderboard";
import { TrendingUp, Shield, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
    const { publicKey } = useWallet();
    const [stats, setStats] = useState({
        totalTrades: 0,
        totalVolume: 0,
        totalPoints: 0,
        tradeCount: 0,
        totalFeesPaid: 0
    });
    const [holdingsUSD, setHoldingsUSD] = useState(0);
    const [tierInfo, setTierInfo] = useState<ReturnType<typeof getCurrentTier> | null>(null);
    const [userRank, setUserRank] = useState<number | null>(null);
    const [milestoneStatus, setMilestoneStatus] = useState<ReturnType<typeof checkMilestoneEligibility> | null>(null);

    useEffect(() => {
        if (publicKey) {
            const walletAddr = publicKey.toString();

            // Fetch user stats from Firestore
            getUserStats(walletAddr).then(data => {
                setStats({
                    totalTrades: data.tradeCount || 0,
                    totalVolume: data.volume || 0,
                    totalPoints: data.points || 0,
                    tradeCount: data.tradeCount || 0,
                    totalFeesPaid: data.totalFeesPaid || 0
                });

                // Check milestone eligibility
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

            // Fetch SHULEVITZ holdings for fee tier
            getShulevitzHoldingsUSD(walletAddr).then(holdings => {
                setHoldingsUSD(holdings);
                setTierInfo(getCurrentTier(holdings));
            });
        }
    }, [publicKey]);

    return (
        <main className="flex min-h-screen flex-col bg-background">
            <div className="container mx-auto p-4 md:p-8">
                <h1 className="mb-8 text-3xl font-bold text-primary">TRADER DASHBOARD</h1>

                {/* Platform Transparency (Global Mock Data) */}
                <div className="mb-8 grid gap-6 md:grid-cols-4">
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                        <div className="text-xs text-muted-foreground">SHX 24h Volume</div>
                        <div className="mt-1 text-2xl font-bold text-white">$425.5K</div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                        <div className="text-xs text-muted-foreground">Active Wallets</div>
                        <div className="mt-1 text-2xl font-bold text-white">842</div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                        <div className="text-xs text-muted-foreground">Total Swaps</div>
                        <div className="mt-1 text-2xl font-bold text-white">1,842</div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                        <div className="text-xs text-muted-foreground">SHX Burned</div>
                        <div className="mt-1 text-2xl font-bold text-primary">450K 🔥</div>
                    </div>
                </div>

                {/* Fee Tier Card */}
                {publicKey && tierInfo && (
                    <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <TrendingUp className="text-primary" size={24} />
                            <h2 className="text-xl font-bold text-white">Your Fee Tier</h2>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <div className="text-sm text-muted-foreground">$SHULEVITZ Holdings</div>
                                <div className="text-2xl font-bold text-white">${holdingsUSD.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Current Fee</div>
                                <div className="text-2xl font-bold text-primary">{(tierInfo.current.feeBps / 100).toFixed(2)}%</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Discount</div>
                                <div className="text-2xl font-bold text-green-400">{tierInfo.current.discount}</div>
                            </div>
                        </div>

                        {tierInfo.next && (
                            <div className="mt-4">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Progress to ${tierInfo.next.minHoldingsUSD.toLocaleString()} tier ({(tierInfo.next.feeBps / 100).toFixed(2)}% fee)</span>
                                    <span>{tierInfo.progressToNext}%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-500"
                                        style={{ width: `${tierInfo.progressToNext}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-4 h-px w-full bg-white/10" />
                <h2 className="mb-4 text-xl font-bold text-white">Review Your Performance</h2>

                <div className="grid gap-6 md:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-card p-6">
                        <div className="text-sm text-muted-foreground">Your Volume (USD)</div>
                        <div className="mt-2 text-3xl font-bold text-white">${stats.totalVolume.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-card p-6">
                        <div className="text-sm text-muted-foreground">Trades Executed</div>
                        <div className="mt-2 text-3xl font-bold text-white">{stats.tradeCount}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-card p-6">
                        <div className="text-sm text-muted-foreground">Fees Paid</div>
                        <div className="mt-2 text-3xl font-bold text-white">${stats.totalFeesPaid.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-card p-6">
                        <div className="text-sm text-muted-foreground">Your XP</div>
                        <div className="mt-2 text-3xl font-bold text-primary">{stats.totalPoints.toLocaleString()}</div>
                    </div>
                </div>

                {/* Milestone Status */}
                {userRank && userRank <= 10 && milestoneStatus && (
                    <div className={`mt-6 rounded-xl border p-4 ${milestoneStatus.eligible ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
                        <div className="flex items-center gap-2">
                            {milestoneStatus.eligible ? (
                                <Shield className="text-green-400" size={20} />
                            ) : (
                                <AlertTriangle className="text-yellow-400" size={20} />
                            )}
                            <span className="font-bold text-white">Rank #{userRank} Milestone Status</span>
                        </div>
                        {milestoneStatus.eligible ? (
                            <p className="mt-2 text-sm text-green-400">
                                ✅ Eligible for ${milestoneStatus.reward} reward + {(milestoneStatus.nextDayFee! / 100).toFixed(2)}% next-day fee
                            </p>
                        ) : (
                            <p className="mt-2 text-sm text-yellow-400">{milestoneStatus.reason}</p>
                        )}
                    </div>
                )}

                <div className="mt-12 grid gap-8 lg:grid-cols-2">
                    <div>
                        <h2 className="mb-4 text-xl font-bold text-white">Global Leaderboard</h2>
                        <Leaderboard userScore={stats.totalPoints} />
                    </div>
                    <div>
                        <h2 className="mb-4 text-xl font-bold text-white">Eligibility Guards</h2>
                        <div className="rounded-xl border border-white/10 bg-card p-6 text-sm text-muted-foreground space-y-2">
                            <p>• Wallet must execute at least <span className="text-white font-bold">5 trades</span></p>
                            <p>• Wallet must pay ≥ <span className="text-white font-bold">$25</span> in total fees</p>
                            <p>• Wash trading, self-crossing, and circular routing excluded</p>
                            <p>• Rewards unlock only if rank-specific volume milestone is met</p>
                            <p>• Unclaimed rewards return to the SHX rewards treasury</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

