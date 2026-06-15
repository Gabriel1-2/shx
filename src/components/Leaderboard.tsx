"use client";

import { useEffect, useState } from "react";
import { getWeeklyLeaderboard, getDailyLeaderboard, type LeaderboardEntry } from "@/lib/points";
import { getEstimatedReward, WEEKLY_REWARD_POOL_USD } from "@/lib/feeTiers";
import { Trophy, TrendingUp, Medal, Crown, Users, Clock, DollarSign } from "lucide-react";

export function Leaderboard() {
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState("");
    const [mode, setMode] = useState<"weekly" | "daily">("weekly");

    // Fetch leaderboard
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            if (mode === "weekly") {
                const weekly = await getWeeklyLeaderboard();
                if (weekly.length > 0) {
                    setData(weekly);
                } else {
                    // Fall back to daily if weekly is empty
                    const daily = await getDailyLeaderboard();
                    if (daily.length > 0) {
                        setData(daily);
                        setMode("daily");
                    } else {
                        setData([]);
                    }
                }
            } else {
                const daily = await getDailyLeaderboard();
                setData(daily);
            }
            setLoading(false);
        };
        fetchData();

        // Poll every 30s
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [mode]);

    // Countdown to next Monday
    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();
            const day = now.getUTCDay();
            const daysUntilMonday = day === 0 ? 1 : (8 - day);
            const nextMonday = new Date(now);
            nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
            nextMonday.setUTCHours(0, 0, 0, 0);

            const diff = nextMonday.getTime() - now.getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            setTimeLeft(`${days}d ${hours}h ${mins}m`);
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 60000);
        return () => clearInterval(timer);
    }, []);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Crown size={12} className="text-yellow-500" />;
        if (rank === 2) return <Medal size={12} className="text-gray-400" />;
        if (rank === 3) return <Medal size={12} className="text-orange-600" />;
        return null;
    };

    const getRankStyle = (rank: number) => {
        if (rank === 1) return "bg-gradient-to-r from-yellow-500 to-amber-500 text-black";
        if (rank === 2) return "bg-gradient-to-r from-gray-400 to-gray-500 text-black";
        if (rank === 3) return "bg-gradient-to-r from-orange-600 to-orange-700 text-white";
        return "bg-white/10 text-muted-foreground";
    };

    const formatVolume = (vol: number) => {
        if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
        if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
        return `$${vol.toFixed(0)}`;
    };

    return (
        <div className="w-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={16} />
                    <h3 className="text-sm font-bold text-white">WEEKLY LEADERBOARD</h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock size={10} />
                    <span>Resets in {timeLeft}</span>
                </div>
            </div>

            {/* Reward Pool Banner */}
            <div className="px-4 py-2 border-b border-white/5 bg-gradient-to-r from-yellow-500/5 to-amber-500/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <DollarSign size={12} className="text-yellow-400" />
                        <span className="text-[11px] text-yellow-400 font-medium">
                            Weekly Prize Pool: ${WEEKLY_REWARD_POOL_USD} in SHX
                        </span>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setMode("weekly")}
                            className={`text-[10px] px-2 py-0.5 rounded-full transition-all ${
                                mode === "weekly" 
                                    ? "bg-yellow-500/20 text-yellow-400 font-bold" 
                                    : "text-muted-foreground hover:text-white"
                            }`}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setMode("daily")}
                            className={`text-[10px] px-2 py-0.5 rounded-full transition-all ${
                                mode === "daily" 
                                    ? "bg-purple-500/20 text-purple-400 font-bold" 
                                    : "text-muted-foreground hover:text-white"
                            }`}
                        >
                            Daily
                        </button>
                    </div>
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/5">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Wallet</div>
                <div className="col-span-2 text-right">Trades</div>
                <div className="col-span-3 text-right">{mode === "weekly" ? "Fees Gen." : "Daily Vol"}</div>
                <div className="col-span-2 text-right">{mode === "weekly" ? "Reward" : "Daily Fees"}</div>
            </div>

            {/* Entries */}
            <div className="p-3 space-y-1.5">
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 animate-pulse">
                                <div className="w-6 h-6 rounded-full bg-white/10" />
                                <div className="flex-1 h-3 bg-white/10 rounded" />
                                <div className="w-16 h-3 bg-white/10 rounded" />
                            </div>
                        ))}
                    </div>
                ) : data.length === 0 ? (
                    <div className="py-8 text-center">
                        <Users size={32} className="text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">No traders yet this week</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Make a swap to be the first on the leaderboard! 🚀
                        </p>
                    </div>
                ) : (
                    data.map((entry, index) => {
                        const reward = getEstimatedReward(entry.rank);
                        const displayValue = mode === "weekly" ? (entry.weeklyFeesPaid || 0) : (entry.dailyVolume || 0);
                        const formattedValue = mode === "weekly" ? `$${displayValue.toFixed(2)}` : formatVolume(displayValue);
                        return (
                            <div
                                key={entry.wallet}
                                className="grid grid-cols-12 items-center rounded-xl p-2.5 bg-white/5 hover:bg-white/10 transition-all duration-300"
                                style={{
                                    animationDelay: `${index * 80}ms`,
                                    animation: "fadeIn 0.3s ease forwards"
                                }}
                            >
                                {/* Rank */}
                                <div className="col-span-1">
                                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${getRankStyle(entry.rank)}`}>
                                        {getRankIcon(entry.rank) || entry.rank}
                                    </span>
                                </div>

                                {/* Wallet */}
                                <div className="col-span-4">
                                    <span className="font-mono text-sm text-gray-300">
                                        {`${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`}
                                    </span>
                                </div>

                                {/* Trades */}
                                <div className="col-span-2 text-right">
                                    <span className="text-xs text-muted-foreground">
                                        {entry.tradeCount || 0}
                                    </span>
                                </div>

                                {/* Volume / Fees */}
                                <div className="col-span-3 text-right">
                                    <span className={`text-sm font-bold ${entry.rank <= 3 ? "text-white" : "text-gray-300"}`}>
                                        {formattedValue}
                                    </span>
                                </div>

                                {/* Reward / Fees */}
                                <div className="col-span-2 text-right">
                                    {mode === "weekly" ? (
                                        <span className="text-sm font-bold text-green-400">
                                            {reward > 0 ? `$${reward.toFixed(0)}` : "—"}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">
                                            ${(entry.dailyFeesPaid || 0).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                <TrendingUp size={10} />
                <span>Ranked by Fees Generated • Top 10 earn SHX rewards (Min $10 Fees)</span>
            </div>
        </div>
    );
}
