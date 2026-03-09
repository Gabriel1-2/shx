"use client";

import { useState } from "react";
import { Loader2, TrendingUp, ExternalLink } from "lucide-react";

interface TradingViewWidgetProps {
    tokenAddress: string;
    symbol?: string;
}

export function TradingViewWidget({ tokenAddress, symbol = "Token" }: TradingViewWidgetProps) {
    const [isLoading, setIsLoading] = useState(true);

    if (!tokenAddress) {
        return (
            <div className="w-full h-[500px] flex items-center justify-center bg-[#0A0A0A] border border-white/10 rounded-2xl text-muted-foreground">
                Select a token to view chart
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-0">
            {/* Chart Header */}
            <div className="flex items-center justify-between rounded-t-2xl bg-black/60 px-4 py-3 border border-b-0 border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                    <TrendingUp size={14} className="text-primary" />
                    <span className="font-bold text-white text-sm">{symbol}/USD</span>
                    <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                        TradingView
                    </span>
                </div>
                <a
                    href={`https://dexscreener.com/solana/${tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-white transition-colors"
                >
                    <span>DexScreener</span>
                    <ExternalLink size={10} />
                </a>
            </div>

            {/* Chart Container */}
            <div className="relative w-full h-[600px] bg-[#0A0A0A] rounded-b-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/50">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A] z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-primary" size={28} />
                            <span className="text-sm text-muted-foreground font-medium">Loading Chart...</span>
                        </div>
                    </div>
                )}
                <iframe
                    src={`https://dexscreener.com/solana/${tokenAddress}?embed=1&theme=dark&trades=0&info=0`}
                    className="w-full h-full border-0"
                    onLoad={() => setIsLoading(false)}
                    title="TradingView Chart"
                    allow="clipboard-write"
                />
            </div>
        </div>
    );
}
