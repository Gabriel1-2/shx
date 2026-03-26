"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { FEE_TIERS } from "@/lib/feeTiers";
import { useSHXTier } from "@/hooks/useSHXTier";
import {
    Shield, Coins, Sparkles, TrendingDown, Layers
} from "lucide-react";

export function FeeTransparency() {
    const { connected } = useWallet();
    const tierData = useSHXTier();

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                <Layers size={14} className="text-primary" />
                <h3 className="text-sm font-bold text-white">Fee Tiers</h3>
            </div>

            <div className="p-4 space-y-3">
                {/* User's Current Tier */}
                {connected && (
                    <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-emerald-500/10 border border-primary/20">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tierData.tier.color }} />
                                <span className="text-sm font-bold text-white">{tierData.label}</span>
                            </div>
                            <span className="text-lg font-bold text-primary">{tierData.feePercent}%</span>
                        </div>
                        {tierData.feeBps < FEE_TIERS[0].feeBps && (
                            <div className="flex items-center gap-1 text-green-400 text-[11px]">
                                <TrendingDown size={10} />
                                <span>Saving {(FEE_TIERS[0].feePercent - tierData.feePercent).toFixed(2)}% vs base</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Tier Table */}
                <div className="space-y-1">
                    {FEE_TIERS.map((t) => (
                        <div
                            key={t.tier}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${connected && tierData.tier.tier === t.tier
                                    ? "bg-primary/10 border border-primary/20 scale-[1.02]"
                                    : "bg-white/5 hover:bg-white/10"
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                                <span className="font-bold text-white">{t.label}</span>
                            </div>
                            <div className="flex items-center gap-4 text-muted-foreground">
                                <span className="font-mono">{t.minSHX > 0 ? `${(t.minSHX / 1000).toFixed(0)}K` : '0'} SHX</span>
                                <span className="font-bold text-white w-10 text-right">{t.feePercent}%</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 0% SHX Buy Callout */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <Sparkles size={14} className="text-green-400" />
                        <span className="text-xs text-green-400 font-bold">
                            0% platform fee when buying SHX!
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Only Jupiter + LP fees apply
                    </p>
                </div>

                {/* How It Works */}
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { label: "Hold SHX", desc: "Lower fees", color: "text-purple-400" },
                        { label: "Buy SHX", desc: "0% fee", color: "text-green-400" },
                        { label: "Trade More", desc: "Earn rewards", color: "text-yellow-400" },
                    ].map((item, i) => (
                        <div key={i} className="text-center p-2 rounded-lg bg-white/5 border border-white/5">
                            <div className={`text-xs font-bold ${item.color}`}>{item.label}</div>
                            <div className="text-[9px] text-muted-foreground">{item.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
