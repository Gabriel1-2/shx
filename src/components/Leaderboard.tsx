"use client";

import { useEffect, useState } from "react";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/points";
import { Trophy, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export function Leaderboard({ userScore }: { userScore?: number }) {
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getLeaderboard().then((res) => {
            // MVP Trick: If user has a score, check if they beat the bots.
            // For now, if userScore > 0, we just prepend them as "YOU" to show it works.
            let displayData = [...res];
            if (userScore && userScore > 0) {
                const userEntry: LeaderboardEntry = {
                    rank: 999, // Placeholder, will sort
                    wallet: "YOU (Local)",
                    points: userScore,
                    volume: 0 // Placeholder
                };
                displayData.push(userEntry);
                // Sort by points desc
                displayData.sort((a, b) => b.points - a.points);
                // Re-rank
                displayData = displayData.map((d, i) => ({ ...d, rank: i + 1 })).slice(0, 5); // Top 5 only
            }

            setData(displayData);
            setLoading(false);
        });
    }, [userScore]);

    return (
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
                <Trophy className="text-yellow-500" size={18} />
                <h3 className="font-bold text-white">TRADER LEADERBOARD</h3>
            </div>

            <div className="space-y-2">
                {loading ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">Loading ranks...</div>
                ) : (
                    data.map((entry, index) => (
                        <motion.div
                            key={entry.wallet}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-center justify-between rounded-lg p-2 transition-colors ${entry.wallet.includes("YOU") ? "border border-primary/20 bg-primary/10" : "bg-white/5 hover:bg-white/10"}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${entry.rank === 1 ? 'bg-yellow-500 text-black' : entry.rank === 2 ? 'bg-gray-400 text-black' : entry.rank === 3 ? 'bg-orange-700 text-white' : 'bg-transparent text-muted-foreground'}`}>
                                    {entry.rank}
                                </span>
                                <span className={`font-mono text-sm ${entry.wallet.includes("YOU") ? "font-bold text-primary" : "text-gray-300"}`}>{entry.wallet}</span>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-primary">{entry.points.toLocaleString()} XP</div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 border-t border-white/5 pt-3 text-xs text-muted-foreground">
                <TrendingUp size={12} />
                <span>Updates Live • Weekly Reset</span>
            </div>
        </div>
    );
}
