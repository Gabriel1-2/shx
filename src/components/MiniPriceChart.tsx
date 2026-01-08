"use client";

import { useState, useEffect } from "react";

interface PriceChartProps {
    tokenAddress: string;
    height?: number;
}

interface PricePoint {
    time: number;
    price: number;
}

export function MiniPriceChart({ tokenAddress, height = 40 }: PriceChartProps) {
    const [priceData, setPriceData] = useState<PricePoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [trend, setTrend] = useState<"up" | "down" | "neutral">("neutral");
    const [change24h, setChange24h] = useState(0);

    useEffect(() => {
        const fetchPriceHistory = async () => {
            setLoading(true);
            try {
                // DexScreener API for price history
                const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
                const data = await res.json();

                if (data.pairs && data.pairs.length > 0) {
                    const pair = data.pairs[0];
                    const priceChange = pair.priceChange?.h24 || 0;
                    setChange24h(priceChange);
                    setTrend(priceChange > 0 ? "up" : priceChange < 0 ? "down" : "neutral");

                    // Generate synthetic chart data based on current price and 24h change
                    // (DexScreener doesn't provide historical data in free tier)
                    const currentPrice = parseFloat(pair.priceUsd) || 0;
                    const startPrice = currentPrice / (1 + priceChange / 100);

                    const points: PricePoint[] = [];
                    for (let i = 0; i < 24; i++) {
                        const progress = i / 23;
                        // Create a somewhat realistic looking curve
                        const noise = Math.sin(i * 0.5) * 0.02 + Math.random() * 0.01;
                        const price = startPrice + (currentPrice - startPrice) * progress * (1 + noise);
                        points.push({ time: i, price });
                    }
                    setPriceData(points);
                }
            } catch (error) {
                console.error("Failed to fetch price data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (tokenAddress) {
            fetchPriceHistory();
        }
    }, [tokenAddress]);

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ height }}>
                <div className="w-16 h-2 bg-white/5 rounded animate-pulse"></div>
            </div>
        );
    }

    if (priceData.length === 0) {
        return null;
    }

    // Calculate SVG path
    const minPrice = Math.min(...priceData.map(p => p.price));
    const maxPrice = Math.max(...priceData.map(p => p.price));
    const priceRange = maxPrice - minPrice || 1;

    const width = 100;
    const pathPoints = priceData.map((point, i) => {
        const x = (i / (priceData.length - 1)) * width;
        const y = height - ((point.price - minPrice) / priceRange) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const gradientId = `gradient-${tokenAddress.slice(0, 8)}`;
    const strokeColor = trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#888";

    return (
        <div className="flex items-center gap-2">
            <svg width={width} height={height} className="overflow-visible">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* Area fill */}
                <path
                    d={`${pathPoints} L ${width} ${height} L 0 ${height} Z`}
                    fill={`url(#${gradientId})`}
                />
                {/* Line */}
                <path
                    d={pathPoints}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <span className={`text-[10px] font-bold ${trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"}`}>
                {change24h > 0 ? "+" : ""}{change24h.toFixed(1)}%
            </span>
        </div>
    );
}
