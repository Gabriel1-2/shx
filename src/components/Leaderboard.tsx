"use client";

import { useEffect, useState } from "react";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/points";
import { Trophy, TrendingUp, Medal, Crown, Users } from "lucide-react";

export function Leaderboard({ userScore }: { userScore?: number }) {
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getLeaderboard().then((res) => {
            let displayData = [...res];
            if (userScore && userScore > 0) {
                const userEntry: LeaderboardEntry = {
                    rank: 999,
                    wallet: "YOU (Local)",
                    points: userScore,
                    volume: 0
                };
                displayData.push(userEntry);
                displayData.sort((a, b) => b.points - a.points);
                displayData = displayData.map((d, i) => ({ ...d, rank: i + 1 })).slice(0, 5);
            }
            setData(displayData);
            setLoading(false);
        });
    }, [userScore]);

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

    return (
        <div className="w-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={16} />
                    <h3 className="text-sm font-bold text-white">TRADER LEADERBOARD</h3>
                </div>
                <span className="text-[10px] text-muted-foreground">Top 5</span>
            </div>

            <div className="p-3 space-y-2">
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
                        <p className="text-sm text-muted-foreground">No traders yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Be the first to make a swap!</p>
                    </div>
                ) : (
                    data.map((entry, index) => (
                        <div
                            key={entry.wallet}
                            className={`flex items-center justify-between rounded-xl p-2.5 transition-all duration-300 ${entry.wallet.includes("YOU")
                                    ? "border border-primary/30 bg-primary/10 scale-[1.02]"
                                    : "bg-white/5 hover:bg-white/10"
                                }`}
                            style={{
                                animationDelay: `${index * 100}ms`,
                                animation: "fadeIn 0.3s ease forwards"
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${getRankStyle(entry.rank)}`}>
                                    {getRankIcon(entry.rank) || entry.rank}
                                </span>
                                <span className={`font-mono text-sm truncate max-w-[100px] ${entry.wallet.includes("YOU") ? "font-bold text-primary" : "text-gray-300"
                                    }`}>
                                    {entry.wallet.includes("YOU") ? "YOU" : `${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`}
                                </span>
                            </div>
                            <div className="text-right">
                                <div className={`text-sm font-bold ${entry.rank <= 3 ? "text-white" : "text-primary"}`}>
                                    {entry.points.toLocaleString()} XP
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="px-4 py-2 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                <TrendingUp size={10} />
                <span>Updates Live • Weekly Reset</span>
            </div>
        </div>
    );
}
