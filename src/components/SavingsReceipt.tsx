"use client";

import { useEffect, useState } from "react";
import { Receipt, TrendingDown, Sparkles, ExternalLink, X } from "lucide-react";
import {
    loadLifetimeSavings,
    savingsVsCex,
    type SavingsSnapshot,
} from "@/lib/tradeSavings";

interface Props {
    snapshot: SavingsSnapshot | null;
    txid?: string | null;
    onClose?: () => void;
}

export function SavingsReceipt({ snapshot, txid, onClose }: Props) {
    const [lifetime, setLifetime] = useState(() => loadLifetimeSavings());

    useEffect(() => {
        if (snapshot) setLifetime(snapshot);
        else setLifetime(loadLifetimeSavings());
    }, [snapshot]);

    if (!snapshot && lifetime.tradeCount === 0) return null;
    const s = snapshot || lifetime;
    const vsCex = savingsVsCex(s.lastVolumeUsd, s.lastFeeBps);

    return (
        <div className="mt-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-black/80 to-emerald-500/10 p-3.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-2xl rounded-full pointer-events-none" />
            <div className="relative flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <Receipt size={14} className="text-primary" />
                    </div>
                    <div>
                        <div className="text-xs font-black text-white uppercase tracking-wide">
                            Fee savings receipt
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                            {s.lastTierLabel} · {(s.lastFeeBps / 100).toFixed(2)}% platform fee
                        </div>
                    </div>
                </div>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground"
                        aria-label="Dismiss"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            <div className="relative grid grid-cols-2 gap-2 mb-2">
                <div className="rounded-xl bg-black/40 border border-white/5 px-2.5 py-2">
                    <div className="text-[9px] text-muted-foreground uppercase">This trade</div>
                    <div className="text-sm font-black text-emerald-400 flex items-center gap-1">
                        <TrendingDown size={12} />
                        ${s.lastSavedUsd.toFixed(4)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                        vs SHX base 0.65% · vol ${s.lastVolumeUsd.toFixed(2)}
                    </div>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/5 px-2.5 py-2">
                    <div className="text-[9px] text-muted-foreground uppercase">Lifetime on SHX</div>
                    <div className="text-sm font-black text-primary">
                        ${s.lifetimeSavedUsd.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                        {s.tradeCount} tracked trade{s.tradeCount === 1 ? "" : "s"}
                    </div>
                </div>
            </div>

            {vsCex > 0.0001 && (
                <div className="relative flex items-center gap-1.5 text-[10px] text-lime-300/90 mb-2">
                    <Sparkles size={10} />
                    ~${vsCex.toFixed(3)} better than a flat ~1% CEX-style take on this notional
                </div>
            )}

            {txid && (
                <a
                    href={`https://solscan.io/tx/${txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:underline"
                >
                    Solscan {txid.slice(0, 8)}… <ExternalLink size={9} />
                </a>
            )}
        </div>
    );
}
