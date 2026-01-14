"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { fetchOHLCV } from "@/lib/chartData";
import { Loader2 } from "lucide-react";

interface NativeChartProps {
    tokenAddress: string;
    symbol: string;
}

export const NativeChart = ({ tokenAddress, symbol }: NativeChartProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<any>(null); // Use any to avoid build type errors
    const seriesInstance = useRef<any>(null); // Use any
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<"day" | "hour" | "minute">("hour");

    // Initialize Chart
    useEffect(() => {
        if (!containerRef.current) return;

        // Clean previous
        if (chartInstance.current) {
            chartInstance.current.remove();
        }

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: "#0A0A0A" },
                textColor: "#525252",
            },
            grid: {
                vertLines: { color: "#171717" },
                horzLines: { color: "#171717" },
            },
            width: containerRef.current.clientWidth,
            height: 600,
            timeScale: {
                borderColor: "#171717",
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: "#171717",
                visible: true,
                autoScale: true,
            },
        }) as any;

        // Add Series with Critical Precision Settings
        try {
            const series = chart.addCandlestickSeries({
                upColor: "#22c55e",
                downColor: "#ef4444",
                borderVisible: false,
                wickUpColor: "#22c55e",
                wickDownColor: "#ef4444",
                priceFormat: {
                    type: 'price',
                    precision: 8,
                    minMove: 0.00000001,
                },
            }) as any;
            seriesInstance.current = series;
        } catch (e) {
            console.error("Failed to add series", e);
        }

        chartInstance.current = chart;

        const handleResize = () => {
            if (containerRef.current && chartInstance.current) {
                chartInstance.current.applyOptions({ width: containerRef.current.clientWidth });
            }
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            if (chartInstance.current) {
                chartInstance.current.remove();
                chartInstance.current = null;
            }
        };
    }, []);

    // Fetch Data
    const loadData = useCallback(async () => {
        if (!seriesInstance.current) {
            console.warn("[Chart] No series instance found on loadData call");
            setLoading(false); // Stop spinner!
            return;
        }

        setLoading(true);
        try {
            const data = await fetchOHLCV(tokenAddress, timeframe);
            if (!seriesInstance.current) return; // double check

            if (data && data.length > 0) {
                console.log(`[Chart] Loaded ${data.length} candles for ${symbol}`);
                // Remove duplicates and sort asc
                const sorted = data.sort((a, b) => a.time - b.time);
                const unique = sorted.filter((v, i, a) => a.findIndex(t => t.time === v.time) === i);

                // Verify valid numbers
                const valid = unique.filter(c => !isNaN(c.open) && !isNaN(c.close));

                seriesInstance.current.setData(valid);
                if (chartInstance.current) chartInstance.current.timeScale().fitContent();
            } else {
                console.warn("[Chart] No data returned");
            }
        } catch (e) {
            console.error("Chart Data Error", e);
        } finally {
            setLoading(false);
        }
    }, [tokenAddress, timeframe]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return (
        <div className="relative w-full h-[600px] border border-white/5 rounded-3xl overflow-hidden bg-[#0A0A0A]">
            {/* Header */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <img
                        src={`https://ui-avatars.com/api/?name=${symbol}&background=22c55e&color=000&bold=true`}
                        alt={symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                    <span className="text-white font-bold text-lg">{symbol}/USD</span>
                </div>

                <div className="flex bg-black/50 border border-white/10 rounded-lg p-1 gap-1 backdrop-blur-md">
                    {(['minute', 'hour', 'day'] as const).map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${timeframe === tf
                                ? 'bg-primary text-black'
                                : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                        >
                            {tf === 'minute' ? '15m' : tf === 'hour' ? '1H' : '1D'}
                        </button>
                    ))}
                </div>
                {loading && <Loader2 className="animate-spin text-primary" size={16} />}
            </div>

            <div ref={containerRef} className="w-full h-full" />

            <div className="absolute bottom-4 right-4 z-10 pointer-events-none opacity-20">
                <span className="text-4xl font-bold tracking-tighter text-white">SHX</span>
            </div>
        </div>
    );
};
