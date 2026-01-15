"use client";

import { useState, useEffect } from "react";
import { fetchPoolTrades, TradeData } from "@/lib/chartData";
import { ExternalLink, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface LiveFeedProps {
    tokenAddress?: string; // Optional, defaults to SHULEVITZ if not provided? Or handled by parent.
}

export function LiveFeed({ tokenAddress }: LiveFeedProps) {
    const [trades, setTrades] = useState<TradeData[]>([]);
    const [loading, setLoading] = useState(true);

    const activeToken = tokenAddress || "4FSiK5G5jH936d5e1H8y9564f332152a2334"; // Default fallback

    useEffect(() => {
        const loadTrades = async () => {
            // Don't set loading on poll to avoid flicker
            const data = await fetchPoolTrades(activeToken);
            if (data && data.length > 0) {
                setTrades(data);
            }
            setLoading(false);
        };

        loadTrades();
        const interval = setInterval(loadTrades, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [activeToken]);

    const formatTime = (ts: number) => {
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="rounded-3xl border border-white/5 bg-[#0A0A0A] overflow-hidden shadow-xl h-[400px] flex flex-col">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <h3 className="text-sm font-bold text-white">Live Trades</h3>
                </div>
                <span className="text-[10px] text-muted-foreground bg-black/50 px-2 py-0.5 rounded">Real-time</span>
            </div>

            {/* List Header */}
            <div className="grid grid-cols-3 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-black/20">
                <div>Price (USD)</div>
                <div className="text-right">Total (USD)</div>
                <div className="text-right">Time</div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {loading && trades.length === 0 ? (
                    [1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-8 w-full bg-white/5 animate-pulse my-1" />
                    ))
                ) : (
                    trades.map((tx) => (
                        <a
                            key={tx.txHash}
                            href={`https://solscan.io/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="grid grid-cols-3 px-4 py-2 hover:bg-white/5 transition-colors group cursor-pointer text-xs font-mono"
                        >
                            <div className={`flex items-center gap-1 font-bold ${tx.type === 'buy' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {tx.type === 'buy' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                ${tx.priceUsd.toFixed(8)}
                            </div>
                            <div className="text-right text-white opacity-90">
                                ${tx.volumeUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-right text-muted-foreground group-hover:text-white transition-colors">
                                {formatTime(tx.timestamp)}
                            </div>
                        </a>
                    ))
                )}
                {trades.length === 0 && !loading && (
                    <div className="p-8 text-center text-muted-foreground text-xs">
                        No recent trades found.
                    </div>
                )}
            </div>
        </div>
    );
}
