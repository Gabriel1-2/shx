"use client";

import { Info } from "lucide-react";

export function FeeTransparency() {
    return (
        <div className="rounded-lg border border-white/5 bg-black/40 p-4 backdrop-blur-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <Info size={16} className="text-primary" />
                PROTOCOL MECHANICS
            </h3>

            <div className="space-y-3 text-xs text-muted-foreground">
                <div className="flex justify-between">
                    <span>Routing</span>
                    <span className="text-white">Jupiter Aggregator (Best Price)</span>
                </div>
                <div className="flex justify-between">
                    <span>Liquidity Source</span>
                    <span className="text-white">Non-Custodial (On-Chain)</span>
                </div>

                <div className="my-2 h-px bg-white/10" />

                <div className="flex justify-between">
                    <span>Platform Fee</span>
                    <span className="font-bold text-green-400">0.50%</span>
                </div>
                <div className="flex justify-between">
                    <span>Destination</span>
                    <span className="text-white">SHX Treasury (Buyback & Burn)</span>
                </div>
                <div className="flex justify-between">
                    <span>User Benefit</span>
                    <span className="text-primary">+10 XP per $1 Volume</span>
                </div>
            </div>

            <div className="mt-4 rounded bg-primary/10 p-2 text-[10px] leading-tight text-primary">
                Every trade contributes to the SHX ecosystem. Fees are transparently routed to sustain rewards and development.
            </div>
        </div>
    );
}
