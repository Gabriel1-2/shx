"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
    Shield, Zap, Globe, Coins, ArrowRight, TrendingUp,
    CheckCircle, RefreshCw
} from "lucide-react";

export function FeeTransparency() {
    const { connected } = useWallet();

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                <Shield size={14} className="text-primary" />
                <h3 className="text-sm font-bold text-white">Protocol Mechanics</h3>
            </div>

            {/* Main Stats */}
            <div className="p-4 space-y-4">
                {/* Routing & Execution */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap size={12} className="text-blue-400" />
                            <span className="text-[10px] uppercase tracking-wider text-blue-400">Routing</span>
                        </div>
                        <div className="text-sm font-bold text-white">Jupiter Ultra</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Best price across all DEXs</div>
                    </div>

                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Globe size={12} className="text-purple-400" />
                            <span className="text-[10px] uppercase tracking-wider text-purple-400">Access</span>
                        </div>
                        <div className="text-sm font-bold text-white">Global Access</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">No geo-restrictions</div>
                    </div>
                </div>

                {/* Fee Structure */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/20">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Coins size={14} className="text-green-400" />
                            <span className="text-sm font-bold text-white">Swap Engine</span>
                        </div>
                        <span className="text-lg font-bold text-green-400">Jupiter</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <ArrowRight size={10} className="text-primary" />
                        <span>Fees handled natively by Jupiter&apos;s routing engine</span>
                    </div>
                </div>

                {/* How It Works */}
                <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">How It Works</div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: "Route", pct: "Auto", color: "text-blue-400" },
                            { label: "Execute", pct: "Atomic", color: "text-purple-400" },
                            { label: "Settle", pct: "Instant", color: "text-green-400" },
                        ].map((item, i) => (
                            <div key={i} className="text-center p-2 rounded-lg bg-white/5 border border-white/5">
                                <div className={`text-sm font-bold ${item.color}`}>{item.pct}</div>
                                <div className="text-[9px] text-muted-foreground whitespace-nowrap">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Trust Badges */}
                <div className="flex flex-wrap gap-2">
                    {[
                        { icon: CheckCircle, label: "Non-Custodial" },
                        { icon: Shield, label: "SOL Native" },
                        { icon: RefreshCw, label: "Atomic Swaps" },
                        { icon: TrendingUp, label: "Best Routes" },
                    ].map((badge, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] text-muted-foreground">
                            <badge.icon size={10} className="text-primary" />
                            <span>{badge.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
