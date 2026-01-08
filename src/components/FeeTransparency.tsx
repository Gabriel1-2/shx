"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { getShulevitzHoldingsUSD } from "@/lib/tokenBalance";
import { calculateFeeBps } from "@/lib/feeTiers";
import {
    Shield, Zap, Globe, Coins, ArrowRight, TrendingUp,
    CheckCircle, RefreshCw, Sparkles
} from "lucide-react";

export function FeeTransparency() {
    const { publicKey, connected } = useWallet();
    const [holdingsUSD, setHoldingsUSD] = useState(0);
    const [feeBps, setFeeBps] = useState(50);

    useEffect(() => {
        if (publicKey) {
            getShulevitzHoldingsUSD(publicKey.toString()).then(holdings => {
                setHoldingsUSD(holdings);
                setFeeBps(calculateFeeBps(holdings, false, false));
            });
        }
    }, [publicKey]);

    const discount = feeBps < 50 ? Math.round((1 - feeBps / 50) * 100) : 0;

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
                        <div className="text-sm font-bold text-white">Jupiter Aggregator</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Best price across all DEXs</div>
                    </div>

                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Globe size={12} className="text-purple-400" />
                            <span className="text-[10px] uppercase tracking-wider text-purple-400">Access</span>
                        </div>
                        <div className="text-sm font-bold text-white">Frankfurt Router</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Geo-restriction bypass</div>
                    </div>
                </div>

                {/* Fee Structure */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/20">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Coins size={14} className="text-green-400" />
                            <span className="text-sm font-bold text-white">Platform Fee</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${feeBps < 50 ? 'text-green-400' : 'text-white'}`}>
                                {(feeBps / 100).toFixed(2)}%
                            </span>
                            {discount > 0 && (
                                <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
                                    -{discount}%
                                </span>
                            )}
                        </div>
                    </div>

                    {connected ? (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Sparkles size={10} className="text-primary" />
                            <span>
                                Holding <span className="text-primary font-bold">${holdingsUSD.toLocaleString()}</span> $SHX
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <ArrowRight size={10} className="text-primary" />
                            <span>Hold $SHX for up to <span className="text-green-400 font-bold">90% off</span> fees</span>
                        </div>
                    )}
                </div>

                {/* Where Fees Go */}
                <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fee Distribution</div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: "Buyback", pct: "40%", color: "text-orange-400" },
                            { label: "Referrers", pct: "10%", color: "text-blue-400" },
                            { label: "Treasury", pct: "50%", color: "text-purple-400" },
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
                        { icon: TrendingUp, label: "+10 XP/$1" },
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
