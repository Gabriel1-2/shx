"use client";

import { useEffect, useState } from "react";

interface TradingViewWidgetProps {
    pairAddress?: string;
}

export function TradingViewWidget({ pairAddress }: TradingViewWidgetProps) {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
    }, [pairAddress]);

    if (!pairAddress) {
        return (
            <div className="w-full h-[400px] flex items-center justify-center bg-[#0A0A0A] border border-white/10 rounded-2xl text-muted-foreground">
                Select a token to view chart
            </div>
        );
    }

    return (
        <div className="w-full h-[600px] bg-[#0A0A0A] rounded-2xl border border-white/10 overflow-hidden relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A] z-10">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-muted-foreground">Loading Chart...</span>
                    </div>
                </div>
            )}
            <iframe
                src={`https://dexscreener.com/solana/${pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                className="w-full h-full border-0"
                onLoad={() => setIsLoading(false)}
                title="TradingView Chart"
            />
        </div>
    );
}
