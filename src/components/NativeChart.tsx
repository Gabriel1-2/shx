"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from "lightweight-charts";
import { fetchOHLCV, ChartTimeframe } from "@/lib/chartData";
import { Loader2 } from "lucide-react";

interface NativeChartProps {
    tokenAddress: string;
    symbol: string;
}

export const NativeChart = ({ tokenAddress, symbol }: NativeChartProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<any>(null);
    const seriesInstance = useRef<any>(null);
    const volumeSeriesInstance = useRef<any>(null);

    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<ChartTimeframe>("1h");
    const [legend, setLegend] = useState<any>(null);

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

        // 1. Add Volume Series (Overlay)
        try {
            const volumeSeries = chart.addSeries(HistogramSeries, {
                color: "#26a69a",
                priceFormat: {
                    type: 'volume',
                },
                priceScaleId: '', // Overlay
                scaleMargins: {
                    top: 0.8,
                    bottom: 0,
                },
            });
            volumeSeriesInstance.current = volumeSeries;
        } catch (e) {
            console.error("Volume series error", e);
        }

        // 2. Add Candlestick Series
        try {
            const series = chart.addSeries(CandlestickSeries, {
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

        // 3. Crosshair Logic (Legend)
        chart.subscribeCrosshairMove((param: any) => {
            if (param.time) {
                const data = param.seriesData.get(seriesInstance.current);
                const volumeData = param.seriesData.get(volumeSeriesInstance.current);
                if (data) {
                    setLegend({
                        open: data.open?.toFixed(8) || "0",
                        high: data.high?.toFixed(8) || "0",
                        low: data.low?.toFixed(8) || "0",
                        close: data.close?.toFixed(8) || "0",
                        volume: volumeData ? (volumeData.value?.toLocaleString() || "0") : "0",
                        color: data.close >= data.open ? "#22c55e" : "#ef4444"
                    });
                }
            } else {
                setLegend(null);
            }
        });

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
    const loadData = useCallback(async (silent = false) => {
        if (!seriesInstance.current) return;

        if (!silent) setLoading(true);
        try {
            const data = await fetchOHLCV(tokenAddress, timeframe);
            if (!seriesInstance.current) return;

            if (data && data.length > 0) {
                // Sort & Dedupe
                const sorted = data.sort((a, b) => a.time - b.time);
                const unique = sorted.filter((v, i, a) => a.findIndex(t => t.time === v.time) === i);
                const valid = unique.filter(c => !isNaN(c.open) && !isNaN(c.close));

                seriesInstance.current.setData(valid);

                if (volumeSeriesInstance.current) {
                    const volumes = valid.map(c => ({
                        time: c.time,
                        value: c.volume || 0,
                        color: c.close >= c.open ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"
                    }));
                    volumeSeriesInstance.current.setData(volumes);
                }

                // Update Legend (Silent update shouldn't break interaction, but we update latest val)
                const last = valid[valid.length - 1];
                if (last && !silent) { // Only force set legend on initial load
                    setLegend({
                        open: last.open.toFixed(8),
                        high: last.high.toFixed(8),
                        low: last.low.toFixed(8),
                        close: last.close.toFixed(8),
                        volume: (last.volume || 0).toLocaleString(),
                        color: last.close >= last.open ? "#22c55e" : "#ef4444"
                    });
                }

                if (chartInstance.current && !silent) {
                    chartInstance.current.timeScale().fitContent();
                    // ... fitContent hack ...
                }
            }
        } catch (e) {
            console.error("Chart Data Error", e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [tokenAddress, timeframe]);

    // Initial Load
    useEffect(() => {
        loadData(false);
    }, [loadData]);

    // Live Pulse (30s)
    useEffect(() => {
        const interval = setInterval(() => {
            loadData(true);
        }, 30000);
        return () => clearInterval(interval);
    }, [loadData]);

    return (
        <div className="relative w-full h-[600px] border border-white/5 rounded-3xl overflow-hidden bg-[#0A0A0A] group">
            {/* Header */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <img
                        // ... (Avatar remains same) ...
                        src={`https://ui-avatars.com/api/?name=${symbol}&background=22c55e&color=000&bold=true`}
                        alt={symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                    <span className="text-white font-bold text-lg">{symbol}/USD</span>
                </div>

                <div className="flex bg-black/50 border border-white/10 rounded-lg p-1 gap-1 backdrop-blur-md">
                    {(['15m', '1h', '4h', '1d'] as const).map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${timeframe === tf
                                ? 'bg-primary text-black'
                                : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                        >
                            {tf.toUpperCase()}
                        </button>
                    ))}
                </div>
                {loading && <Loader2 className="animate-spin text-primary" size={16} />}
            </div>

            {/* Pro Legend */}
            <div className="absolute top-16 left-4 z-20 flex items-center gap-4 text-xs font-mono bg-black/40 backdrop-blur-sm p-2 rounded border border-white/5 pointer-events-none transition-opacity opacity-0 group-hover:opacity-100">
                <div className="flex gap-1"><span>O:</span><span style={{ color: legend?.color }}>{legend?.open || '-'}</span></div>
                <div className="flex gap-1"><span>H:</span><span style={{ color: legend?.color }}>{legend?.high || '-'}</span></div>
                <div className="flex gap-1"><span>L:</span><span style={{ color: legend?.color }}>{legend?.low || '-'}</span></div>
                <div className="flex gap-1"><span>C:</span><span style={{ color: legend?.color }}>{legend?.close || '-'}</span></div>
                <div className="flex gap-1 text-muted-foreground"><span>Vol:</span><span>{legend?.volume || '-'}</span></div>
            </div>

            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
};
