"use client";

import { useSolanaTPS } from "@/hooks/useSolanaTPS";

export function SystemStatus() {
    const { tps, loading } = useSolanaTPS();

    return (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h4 className="mb-3 text-sm font-bold text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                System Status
            </h4>
            <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between items-center">
                    <span>Jupiter API</span>
                    <span className="text-green-400 font-medium">Operational</span>
                </div>
                <div className="flex justify-between items-center">
                    <span>Solana TPS</span>
                    <span className={`font-mono font-bold ${tps > 2000 ? 'text-green-400' : tps > 1000 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {loading ? "..." : tps.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span>Shadow Router</span>
                    <span className="text-green-400 font-medium">Frankfurt (DE)</span>
                </div>
            </div>
        </div>
    );
}
