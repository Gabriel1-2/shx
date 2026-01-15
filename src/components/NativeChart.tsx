"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";
import { fetchOHLCV, fetchPoolStats, ChartTimeframe, PoolStats } from "@/lib/chartData";
import { calculateSMA } from "@/lib/indicators";
import { Loader2 } from "lucide-react";

interface NativeChartProps {
    tokenAddress: string;
    symbol: string;
}

const NEON_GREEN = "#4ade80"; // Bright Neon
const NEON_RED = "#f87171";   // Soft Neon Red
const MA20_COLOR = "#eab308"; // Neon Yellow
const MA50_COLOR = "#a855f7"; // Neon Purple

export const NativeChart = ({ tokenAddress, symbol }: NativeChartProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<any>(null);
    const seriesInstance = useRef<any>(null);
    const volumeSeriesInstance = useRef<any>(null);
    const ma20SeriesInstance = useRef<any>(null);
    const ma50SeriesInstance = useRef<any>(null);

    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<ChartTimeframe>("1h");
    const [legend, setLegend] = useState<any>(null);
    const [stats, setStats] = useState<PoolStats | null>(null);

    // Initialize Chart
    useEffect(() => {
        if (!containerRef.current) return;

        // Clean previous
        if (chartInstance.current) {
            chartInstance.current.remove();
        }

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: "transparent" }, // Allow CSS Gradient
                textColor: "#94a3b8",
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: "rgba(30, 41, 59, 0.5)", style: 1 }, // Dotted
                horzLines: { color: "rgba(30, 41, 59, 0.5)", style: 1 },
            },
            width: containerRef.current.clientWidth,
            height: 600,
            timeScale: {
                borderColor: "#334155",
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: "#334155",
                visible: true,
                autoScale: true,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.2, // Space for volume
                },
            },
            crosshair: {
                mode: 1, // Magnet
                vertLine: {
                    width: 1,
                    color: NEON_GREEN,
                    style: 3, // Dashed
                    labelBackgroundColor: NEON_GREEN,
                },
                horzLine: {
                    width: 1,
                    color: NEON_GREEN,
                    style: 3,
                    labelBackgroundColor: NEON_GREEN,
                },
            },
        }) as any;

        // 1. Add Volume Series (Overlay)
        try {
            volumeSeriesInstance.current = chart.addSeries(HistogramSeries, {
                priceFormat: { type: 'volume' },
                priceScaleId: '', // Overlay
                scaleMargins: { top: 0.85, bottom: 0 },
            });
        } catch (e) {
            console.error("Volume series error", e);
        }

        // 2. Add Candlestick Series (Neon)
        try {
            seriesInstance.current = chart.addSeries(CandlestickSeries, {
                upColor: NEON_GREEN,
                downColor: NEON_RED,
                borderVisible: false,
                wickUpColor: NEON_GREEN,
                wickDownColor: NEON_RED,
                priceFormat: {
                    type: 'price',
                    precision: 8,
                    minMove: 0.00000001,
                },
            });
        } catch (e) {
            console.error("Candle series error", e);
        }

        // 3. Add MA Series
        try {
            ma20SeriesInstance.current = chart.addSeries(LineSeries, {
                color: MA20_COLOR,
                lineWidth: 2,
                title: 'MA 20',
                priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
            });

            ma50SeriesInstance.current = chart.addSeries(LineSeries, {
                color: MA50_COLOR,
                lineWidth: 2,
                title: 'MA 50',
                priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
            });

        } catch (e) {
            console.error("MA Series error", e);
        }

        // 4. Crosshair Logic (Legend)
        chart.subscribeCrosshairMove((param: any) => {
            if (param.time) {
                const data = param.seriesData.get(seriesInstance.current);
                const volumeData = param.seriesData.get(volumeSeriesInstance.current);
                const ma20Data = param.seriesData.get(ma20SeriesInstance.current);
                const ma50Data = param.seriesData.get(ma50SeriesInstance.current);

                if (data) {
                    setLegend({
                        open: data.open?.toFixed(8) || "0",
                        high: data.high?.toFixed(8) || "0",
                        low: data.low?.toFixed(8) || "0",
                        close: data.close?.toFixed(8) || "0",
                        volume: volumeData ? (volumeData.value?.toLocaleString() || "0") : "0",
                        color: data.close >= data.open ? NEON_GREEN : NEON_RED,
                        ma20: ma20Data?.value?.toFixed(8),
                        ma50: ma50Data?.value?.toFixed(8)
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
            // Fetch both in parallel
            const [data, poolStats] = await Promise.all([
                fetchOHLCV(tokenAddress, timeframe),
                // Only refresh stats if not silent (or maybe always? let's do always for "Live Pulse")
                fetchPoolStats(tokenAddress)
            ]);

            if (poolStats) setStats(poolStats);
            if (!seriesInstance.current) return;

            if (data && data.length > 0) {
                const sorted = data.sort((a, b) => a.time - b.time);
                const unique = sorted.filter((v, i, a) => a.findIndex(t => t.time === v.time) === i);
                const valid = unique.filter(c => !isNaN(c.open) && !isNaN(c.close));

                seriesInstance.current.setData(valid);

                // Set Volume
                if (volumeSeriesInstance.current) {
                    const volumes = valid.map(c => ({
                        time: c.time,
                        value: c.volume || 0,
                        color: c.close >= c.open ? "rgba(74, 222, 128, 0.2)" : "rgba(248, 113, 113, 0.2)"
                    }));
                    volumeSeriesInstance.current.setData(volumes);
                }

                // Calculate & Set MA Lines
                if (ma20SeriesInstance.current) {
                    const sma20 = calculateSMA(valid, 20);
                    ma20SeriesInstance.current.setData(sma20);
                }
                if (ma50SeriesInstance.current) {
                    const sma50 = calculateSMA(valid, 50);
                    ma50SeriesInstance.current.setData(sma50);
                }

                if (!silent && chartInstance.current) {
                    chartInstance.current.timeScale().fitContent();
                    const last = valid[valid.length - 1];
                    if (last) {
                        setLegend({
                            open: last.open.toFixed(8),
                            high: last.high.toFixed(8),
                            low: last.low.toFixed(8),
                            close: last.close.toFixed(8),
                            volume: (last.volume || 0).toLocaleString(),
                            color: last.close >= last.open ? NEON_GREEN : NEON_RED,
                            // Note: MAs might not exist for the very last candle if logic differs, but usually they do
                            ma20: calculateSMA(valid, 20).pop()?.value.toFixed(8),
                            ma50: calculateSMA(valid, 50).pop()?.value.toFixed(8),
                        });
                    }
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

    // Header Stats Component (Internal)
    const HeaderStat = ({ label, value, colorClass }: { label: string, value: string, colorClass?: string }) => (
        <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</span>
            <span className={`text-xs font-mono font-bold ${colorClass || 'text-white'}`}>{value}</span>
        </div>
    );

    return (
        <div className="relative w-full h-[600px] border border-white/5 rounded-3xl overflow-hidden bg-gradient-to-b from-[#0f172a] to-[#020617] group shadow-2xl shadow-black/50">
            {/* Super Header */}
            <div className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                {/* Left: Token Info */}
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="flex items-center gap-2">
                        <img
                            src={`https://ui-avatars.com/api/?name=${symbol}&background=22c55e&color=000&bold=true`}
                            alt={symbol}
                            className="w-8 h-8 rounded-full ring-2 ring-emerald-500/20"
                            onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                        <div className="flex flex-col">
                            <span className="text-white font-bold text-lg leading-none tracking-tight">{symbol}/USD</span>
                            <span className="text-xs text-emerald-400 font-mono">{timeframe.toUpperCase()}</span>
                        </div>
                    </div>
                </div>

                {/* Center: Market Stats (Desktop) */}
                <div className="hidden md:flex items-center gap-6 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
                    <HeaderStat
                        label="24h Change"
                        value={stats ? `${stats.priceChange24h.toFixed(2)}%` : '...'}
                        colorClass={stats?.priceChange24h && stats.priceChange24h >= 0 ? "text-emerald-400" : "text-rose-400"}
                    />
                    <div className="w-px h-6 bg-white/10" />
                    <HeaderStat label="24h Volume" value={stats ? `$${(stats.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '...'} />
                    <div className="w-px h-6 bg-white/10" />
                    <HeaderStat label="Liquidity" value={stats ? `$${(stats.liquidityUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '...'} />
                </div>

                {/* Right: Controls */}
                <div className="flex bg-black/50 border border-white/10 rounded-lg p-1 gap-1 backdrop-blur-md pointer-events-auto">
                    {(['15m', '1h', '4h', '1d'] as const).map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${timeframe === tf
                                ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {tf.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* H/L/O/C Legend (Moved below header) */}
            <div className={`absolute top-20 left-4 z-10 flex flex-col gap-1 text-xs font-mono transition-opacity duration-200 ${legend ? 'opacity-100' : 'opacity-0'}`}>
                {/* Candle Data */}
                <div className="flex gap-2 bg-black/40 backdrop-blur px-2 py-1 rounded border border-white/5">
                    <span className="text-slate-400">O:</span><span style={{ color: legend?.color }}>{legend?.open}</span>
                    <span className="text-slate-400">H:</span><span style={{ color: legend?.color }}>{legend?.high}</span>
                    <span className="text-slate-400">L:</span><span style={{ color: legend?.color }}>{legend?.low}</span>
                    <span className="text-slate-400">C:</span><span style={{ color: legend?.color }}>{legend?.close}</span>
                    <span className="text-slate-400">Vol:</span><span className="text-white">{legend?.volume}</span>
                </div>
                {/* Indicator Data */}
                {(legend?.ma20 || legend?.ma50) && (
                    <div className="flex gap-4 px-2">
                        {legend.ma20 && <span style={{ color: MA20_COLOR }}>MA20: {legend.ma20}</span>}
                        {legend.ma50 && <span style={{ color: MA50_COLOR }}>MA50: {legend.ma50}</span>}
                    </div>
                )}
            </div>

            {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                </div>
            )}

            <div ref={containerRef} className="w-full h-full opacity-90 hover:opacity-100 transition-opacity" />
        </div>
    );
};
