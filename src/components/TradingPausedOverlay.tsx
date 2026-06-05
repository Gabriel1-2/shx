"use client";

import { ShieldAlert, Wrench } from "lucide-react";
import { MAINTENANCE_MESSAGE } from "@/lib/tradingConfig";

export default function TradingPausedOverlay() {
    return (
        <div className="w-full rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 backdrop-blur-xl p-8 flex flex-col items-center justify-center gap-4 text-center min-h-[300px]">
            <div className="relative">
                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <Wrench className="text-amber-400" size={28} />
                </div>
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2 justify-center">
                    <ShieldAlert size={18} />
                    Trading Paused
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                    {MAINTENANCE_MESSAGE}
                </p>
            </div>
            <div className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[11px] text-amber-400 font-medium uppercase tracking-wider">
                    Maintenance Mode Active
                </span>
            </div>
        </div>
    );
}
