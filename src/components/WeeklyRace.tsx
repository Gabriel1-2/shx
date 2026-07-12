"use client";

/**
 * Weekly volume race — competitive loop that compounds retention.
 * Ranks by weeklyFeesPaid (real platform revenue contribution).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Medal, Trophy, Timer, Gift } from "lucide-react";
import { getWeeklyLeaderboard, type LeaderboardEntry } from "@/lib/points";
import { WEEKLY_REWARD_POOL_USD, getEstimatedReward } from "@/lib/feeTiers";

function shortWallet(w: string) {
    if (!w || w.length < 8) return w;
    return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

function fmtUsd(n: number) {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
}

function nextMondayCountdown(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + daysUntilMonday);
    next.setUTCHours(0, 0, 0, 0);
    const diff = Math.max(0, next.getTime() - now.getTime());
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return `${d}d ${h}h ${m}m`;
}

const RANK_ICON = [Crown, Medal, Trophy];
const RANK_COLOR = ["text-yellow-400", "text-slate-300", "text-amber-600"];

export function WeeklyRace() {
    const [top, setTop] = useState<LeaderboardEntry[]>([]);
    const [countdown, setCountdown] = useState(nextMondayCountdown());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                const rows = await getWeeklyLeaderboard();
                if (alive) setTop(rows.slice(0, 5));
            } catch {
                /* ignore */
            } finally {
                if (alive) setLoading(false);
            }
        };
        load();
        const poll = setInterval(load, 45_000);
        const tick = setInterval(() => setCountdown(nextMondayCountdown()), 30_000);
        return () => {
            alive = false;
            clearInterval(poll);
            clearInterval(tick);
        };
    }, []);

    return (
        <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-black/70 to-purple-500/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 flex-wrap">
                <Trophy size={14} className="text-yellow-400" />
                <span className="text-sm font-black text-white">Weekly Race</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-300 bg-yellow-500/15 border border-yellow-500/25 px-2 py-0.5 rounded-full">
                    <Gift size={10} />
                    ${WEEKLY_REWARD_POOL_USD} pool
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                    <Timer size={10} />
                    {countdown}
                </span>
            </div>

            <div className="p-3 space-y-1.5">
                {loading && top.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Loading race…</p>
                )}
                {!loading && top.length === 0 && (
                    <div className="text-center py-5 px-2">
                        <p className="text-xs text-muted-foreground mb-2">
                            Race is open — trade this week to claim the board.
                        </p>
                        <Link
                            href="/?focus=swap"
                            className="text-[11px] font-bold text-primary hover:underline"
                        >
                            Start trading →
                        </Link>
                    </div>
                )}
                {top.map((row, i) => {
                    const Icon = RANK_ICON[i] || Medal;
                    const color = RANK_COLOR[i] || "text-muted-foreground";
                    const fees = row.weeklyFeesPaid || 0;
                    const est = getEstimatedReward(row.rank || i + 1);
                    return (
                        <div
                            key={row.wallet}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-black/30 border border-white/5"
                        >
                            <div className={`w-6 flex justify-center ${color}`}>
                                {i < 3 ? <Icon size={14} /> : (
                                    <span className="text-[11px] font-bold text-muted-foreground">
                                        {i + 1}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white font-mono truncate">
                                    {shortWallet(row.wallet)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    {fmtUsd(row.weeklyVolume || 0)} vol · {fmtUsd(fees)} fees
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[11px] font-black text-yellow-300">
                                    {est > 0 ? `~$${est.toFixed(2)}` : "—"}
                                </div>
                                <div className="text-[9px] text-muted-foreground">est.</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="px-4 py-2.5 border-t border-white/5 text-[10px] text-muted-foreground leading-relaxed">
                Ranked by fees generated this UTC week. Hold SHX for lower rates — still climb with
                volume. Rewards paid in USDC after reset.
            </div>
        </div>
    );
}
