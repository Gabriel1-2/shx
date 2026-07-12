"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Calculator, TrendingDown, Sparkles } from "lucide-react";
import { FEE_TIERS } from "@/lib/feeTiers";
import { useSHXTier } from "@/hooks/useSHXTier";
import Link from "next/link";

/**
 * Shows dollar savings vs base fee for holding SHX — a differentiator Jupiter UI lacks.
 */
export function SavingsCalculator() {
    const { connected } = useWallet();
    const tierData = useSHXTier();
    const [monthlyVolume, setMonthlyVolume] = useState(50_000);

    const base = FEE_TIERS[0].feePercent;
    const yourFee = connected ? tierData.feePercent : base;

    const math = useMemo(() => {
        const baseCost = monthlyVolume * (base / 100);
        const yourCost = monthlyVolume * (yourFee / 100);
        const saved = Math.max(0, baseCost - yourCost);
        const diamond = FEE_TIERS[FEE_TIERS.length - 1];
        const diamondCost = monthlyVolume * (diamond.feePercent / 100);
        const diamondSave = baseCost - diamondCost;
        return { baseCost, yourCost, saved, diamondSave, diamond };
    }, [monthlyVolume, yourFee, base]);

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                <Calculator size={14} className="text-primary" />
                <h3 className="text-sm font-bold text-white">Fee Savings</h3>
            </div>
            <div className="p-4 space-y-4">
                <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                        <span>Monthly volume</span>
                        <span className="font-mono text-white">
                            ${monthlyVolume.toLocaleString()}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={1_000}
                        max={500_000}
                        step={1_000}
                        value={monthlyVolume}
                        onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                        className="w-full accent-green-500 h-1.5"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/5 border border-white/5 p-3">
                        <div className="text-[9px] text-muted-foreground uppercase">Base fee cost</div>
                        <div className="text-lg font-black text-white font-mono">
                            ${math.baseCost.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{base}%</div>
                    </div>
                    <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
                        <div className="text-[9px] text-primary uppercase">Your cost</div>
                        <div className="text-lg font-black text-primary font-mono">
                            ${math.yourCost.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                            {connected ? `${yourFee}% · ${tierData.label}` : "Connect for tier"}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-green-500/15 to-emerald-500/10 border border-green-500/25 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-green-400 text-xs font-bold mb-1">
                        <TrendingDown size={12} />
                        You save / mo
                    </div>
                    <div className="text-3xl font-black text-green-400 font-mono">
                        ${math.saved.toFixed(0)}
                    </div>
                    {connected && tierData.nextTier && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Diamond ({math.diamond.feePercent}%) would save $
                            {math.diamondSave.toFixed(0)}/mo — need{" "}
                            {tierData.shxNeeded.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                            })}{" "}
                            more SHX
                        </p>
                    )}
                </div>

                <Link
                    href={`/?outputMint=SHX`}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                    <Sparkles size={12} />
                    Buy SHX at 0% platform fee
                </Link>
            </div>
        </div>
    );
}
