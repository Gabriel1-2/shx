"use client";

import { useEffect, useState } from "react";
import { useSolanaTPS } from "@/hooks/useSolanaTPS";

export function SystemStatus() {
    const { tps, loading } = useSolanaTPS();
    const [traders, setTraders] = useState<number | null>(null);

    useEffect(() => {
        const load = () => {
            fetch("/api/stats/live")
                .then((r) => r.json())
                .then((d) => setTraders(d.walletsTraded ?? d.tradersAllTime ?? 0))
                .catch(() => {});
        };
        load();
        const i = setInterval(load, 30_000);
        window.addEventListener("shx-swap-success", load);
        return () => {
            clearInterval(i);
            window.removeEventListener("shx-swap-success", load);
        };
    }, []);

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
                    <span>Wallets traded</span>
                    <span className="text-primary font-mono font-bold">
                        {traders == null ? "…" : traders.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span>Solana TPS</span>
                    <span className={`font-mono font-bold ${tps > 2000 ? "text-green-400" : tps > 1000 ? "text-yellow-400" : "text-red-400"}`}>
                        {loading ? "..." : tps.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span>Network</span>
                    <span className="text-green-400 font-medium">Solana Mainnet</span>
                </div>
            </div>
        </div>
    );
}
