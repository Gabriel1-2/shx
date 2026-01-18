"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, AreaSeries } from "lightweight-charts";
import { fetchOHLCV, fetchPoolStats, ChartTimeframe, PoolStats } from "@/lib/chartData";
import { calculateSMA, calculateRSI, calculateBollingerBands } from "@/lib/indicators";
import { Loader2, TrendingUp, Clock, Activity, Layers } from "lucide-react";

interface NativeChartProps {
    tokenAddress: string;
    symbol: string;
}

const NEON_GREEN = "#4ade80"; // Bright Neon
const NEON_RED = "#f87171";   // Soft Neon Red
const MA20_COLOR = "#eab308"; // Neon Yellow
const MA50_COLOR = "#a855f7"; // Neon Purple
const RSI_COLOR = "#38bdf8";  // Sky Blue

export const NativeChart = ({ tokenAddress, symbol }: NativeChartProps) => {
    // --- Refs ---
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const rsiContainerRef = useRef<HTMLDivElement>(null);

    const chartInstance = useRef<any>(null);
    const rsiChartInstance = useRef<any>(null);

    const candleSeries = useRef<any>(null);
    const volumeSeries = useRef<any>(null);
    const ma20Series = useRef<any>(null);
    const ma50Series = useRef<any>(null);
    const bbUpperSeries = useRef<any>(null);
    const bbLowerSeries = useRef<any>(null);
    const bbMidSeries = useRef<any>(null);

    // RSI Series
    const rsiSeries = useRef<any>(null);
    const rsiOverboughtLine = useRef<any>(null);
    const rsiOversoldLine = useRef<any>(null);

    // --- State ---
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<ChartTimeframe>("1h");
    const [legend, setLegend] = useState<any>(null);
    const [stats, setStats] = useState<PoolStats | null>(null);

    // Toggles
    const [showRSI, setShowRSI] = useState(false);
    const [showBB, setShowBB] = useState(false);
    const [countdown, setCountdown] = useState<string>("");

    // --- Chart Initialization ---
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 1. Cleanup Old
        if (chartInstance.current) chartInstance.current.remove();
        if (rsiChartInstance.current) rsiChartInstance.current.remove();

        // 2. Create Main Chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#94a3b8",
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: "rgba(30, 41, 59, 0.3)", style: 1 },
                horzLines: { color: "rgba(30, 41, 59, 0.3)", style: 1 },
            },
            width: chartContainerRef.current.clientWidth,
            height: showRSI ? 450 : 600, // Adjust height
            timeScale: {
                borderColor: "#334155",
                timeVisible: true,
                secondsVisible: false,
                visible: !showRSI, // Hide X axis if RSI is below (shared axis effect)
            },
            rightPriceScale: {
                borderColor: "#334155",
                scaleMargins: { top: 0.1, bottom: 0.2 },
            },
            crosshair: {
                mode: 1, // Magnet
                vertLine: { width: 1, color: NEON_GREEN, style: 3, labelBackgroundColor: NEON_GREEN },
                horzLine: { width: 1, color: NEON_GREEN, style: 3, labelBackgroundColor: NEON_GREEN },
            },
        }) as any;

        // Series
        volumeSeries.current = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: '',
            scaleMargins: { top: 0.85, bottom: 0 },
        });
        candleSeries.current = chart.addSeries(CandlestickSeries, {
            upColor: NEON_GREEN, downColor: NEON_RED,
            borderVisible: false, wickUpColor: NEON_GREEN, wickDownColor: NEON_RED,
        });
        ma20Series.current = chart.addSeries(LineSeries, { color: MA20_COLOR, lineWidth: 2, title: 'MA 20' });
        ma50Series.current = chart.addSeries(LineSeries, { color: MA50_COLOR, lineWidth: 2, title: 'MA 50' });

        // BB Placeholders
        bbUpperSeries.current = chart.addSeries(LineSeries, { color: 'rgba(56, 189, 248, 0.5)', lineWidth: 1 });
        bbLowerSeries.current = chart.addSeries(LineSeries, { color: 'rgba(56, 189, 248, 0.5)', lineWidth: 1 });

        chartInstance.current = chart;

        // 3. Create RSI Chart (Pane 2)
        if (showRSI && rsiContainerRef.current) {
            const rsiChart = createChart(rsiContainerRef.current, {
                layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#94a3b8", attributionLogo: false },
                grid: { vertLines: { color: "rgba(30, 41, 59, 0.3)" }, horzLines: { color: "rgba(30, 41, 59, 0.3)" } },
                width: rsiContainerRef.current.clientWidth,
                height: 150,
                timeScale: { borderColor: "#334155", timeVisible: true },
                rightPriceScale: { borderColor: "#334155" },
                crosshair: { mode: 1 },
            }) as any;

            rsiSeries.current = rsiChart.addSeries(LineSeries, { color: RSI_COLOR, lineWidth: 2 });

            // Add RSI Bands (using horizontal lines purely visual via series? No, simple lines not supported easily. 
            // We'll use PriceLines on the series itself, set in LoadData)

            rsiChartInstance.current = rsiChart;

            // Sync Crosshairs & Time
            chart.timeScale().subscribeVisibleTimeRangeChange((range: any) => {
                rsiChart.timeScale().setVisibleRange(range);
            });
            rsiChart.timeScale().subscribeVisibleTimeRangeChange((range: any) => {
                chart.timeScale().setVisibleRange(range);
            });

            // Crosshair Sync (Simplified: just mouse move propagation is hard without shared state, 
            // but Lightweight charts has examples. For now we sync Time Range which is most important)
        }

        // 4. Resize Handling
        const handleResize = () => {
            if (chartContainerRef.current && chartInstance.current) {
                chartInstance.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
            if (rsiContainerRef.current && rsiChartInstance.current) {
                rsiChartInstance.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
            }
        };
        window.addEventListener("resize", handleResize);

        // 5. Crosshair Legend
        chart.subscribeCrosshairMove((param: any) => {
            if (param.time) {
                const data = param.seriesData.get(candleSeries.current);
                const vol = param.seriesData.get(volumeSeries.current);
                const ma20 = param.seriesData.get(ma20Series.current);
                const ma50 = param.seriesData.get(ma50Series.current);

                // Get RSI Value if synced? 
                // Getting RSI value from specific time requires looking up data manually since separate chart. 
                // We'll skip RSI in main legend for now to keep code simple.

                if (data) {
                    setLegend({
                        open: data.open?.toFixed(8),
                        high: data.high?.toFixed(8),
                        low: data.low?.toFixed(8),
                        close: data.close?.toFixed(8),
                        volume: (vol?.value || 0).toLocaleString(),
                        color: data.close >= data.open ? NEON_GREEN : NEON_RED,
                        ma20: ma20?.value?.toFixed(8),
                        ma50: ma50?.value?.toFixed(8)
                    });
                }
            } else {
                setLegend(null);
            }
        });

        return () => {
            window.removeEventListener("resize", handleResize);
            if (chartInstance.current) chartInstance.current.remove();
            if (rsiChartInstance.current) rsiChartInstance.current.remove();
        };

    }, [showRSI]); // Re-create if layout changes

    // --- Time Countdown Logic ---
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            let secondsLeft = 0;
            const m = now.getMinutes();
            const s = now.getSeconds();

            if (timeframe === "15m") secondsLeft = (15 - (m % 15)) * 60 - s;
            else if (timeframe === "1h") secondsLeft = (60 - m) * 60 - s;
            else if (timeframe === "4h") secondsLeft = (240 - ((now.getHours() * 60 + m) % 240)) * 60 - s;
            else if (timeframe === "1d") secondsLeft = (24 * 60 * 60) - (now.getHours() * 3600 + m * 60 + s);

            if (secondsLeft > 0) {
                const hh = Math.floor(secondsLeft / 3600);
                const mm = Math.floor((secondsLeft % 3600) / 60);
                const ss = secondsLeft % 60;
                setCountdown(`${hh > 0 ? hh + ':' : ''}${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [timeframe]);


    // --- Data Fetching ---
    const loadData = useCallback(async (silent = false) => {
        if (!candleSeries.current) return;
        if (!silent) setLoading(true);

        try {
            const [data, poolStats] = await Promise.all([
                fetchOHLCV(tokenAddress, timeframe),
                fetchPoolStats(tokenAddress)
            ]);

            if (poolStats) setStats(poolStats);

            if (data && data.length > 0) {
                const sorted = data.sort((a, b) => a.time - b.time);
                const unique = sorted.filter((v, i, a) => a.findIndex(t => t.time === v.time) === i);
                const valid = unique.filter(c => !isNaN(c.open) && !isNaN(c.close));

                candleSeries.current.setData(valid);

                // Volume
                const volumes = valid.map(c => ({
                    time: c.time,
                    value: c.volume || 0,
                    color: c.close >= c.open ? "rgba(74, 222, 128, 0.2)" : "rgba(248, 113, 113, 0.2)"
                }));
                volumeSeries.current.setData(volumes);

                // MAs
                ma20Series.current.setData(calculateSMA(valid, 20));
                ma50Series.current.setData(calculateSMA(valid, 50));

                // Bollinger Bands
                if (showBB) {
                    const bb = calculateBollingerBands(valid);
                    bbUpperSeries.current.setData(bb.map(b => ({ time: b.time, value: b.upper })));
                    bbLowerSeries.current.setData(bb.map(b => ({ time: b.time, value: b.lower })));
                    // We could fill area if we swapped to AreaSeries, need support for transparent fill
                } else {
                    bbUpperSeries.current.setData([]);
                    bbLowerSeries.current.setData([]);
                }

                // RSI
                if (showRSI && rsiSeries.current) {
                    const rsi = calculateRSI(valid);
                    rsiSeries.current.setData(rsi);

                    // Add Static levels for 70/30
                    // Lightweight charts 4.0 API: createPriceLine
                    // We clear old ones first if needed (not easy), but duplicates are harmless if we don't spam.
                    /* 
                       Note: ideally store reference to priceLines to remove them. 
                       Skipping constant add/remove for MVP performace.
                    */
                }

                if (!silent && chartInstance.current) {
                    chartInstance.current.timeScale().fitContent();
                }
            }
        } catch (e) {
            console.error("Chart Data Error", e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [tokenAddress, timeframe, showBB, showRSI]);

    // Initial Load & Polling
    useEffect(() => { loadData(false); }, [loadData]);
    useEffect(() => {
        const i = setInterval(() => loadData(true), 30000);
        return () => clearInterval(i);
    }, [loadData]);

    const HeaderStat = ({ label, value, colorClass }: { label: string, value: string, colorClass?: string }) => (
        <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</span>
            <span className={`text-xs font-mono font-bold ${colorClass || 'text-white'}`}>{value}</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-2 w-full">
            {/* Main Chart Container */}
            <div className={`relative w-full border border-white/5 rounded-3xl overflow-hidden bg-gradient-to-b from-[#0f172a] to-[#020617] group shadow-2xl shadow-black/50 transition-all duration-300 ${showRSI ? 'h-[450px]' : 'h-[600px]'}`}>

                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                    {/* Token Info */}
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
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-emerald-400 font-mono">{timeframe.toUpperCase()}</span>
                                    {countdown && <span className="text-xs text-slate-500 font-mono flex items-center gap-1"><Clock size={10} />{countdown}</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-6 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
                        <HeaderStat label="24h Change" value={stats ? `${stats.priceChange24h.toFixed(2)}%` : '...'} colorClass={stats?.priceChange24h && stats.priceChange24h >= 0 ? "text-emerald-400" : "text-rose-400"} />
                        <div className="w-px h-6 bg-white/10" />
                        <HeaderStat label="Volume" value={stats ? `$${(stats.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '...'} />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 pointer-events-auto">
                        <div className="flex bg-black/50 border border-white/10 rounded-lg p-1 gap-1 backdrop-blur-md">
                            {(['15m', '1h', '4h', '1d'] as const).map((tf) => (
                                <button key={tf} onClick={() => setTimeframe(tf)} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${timeframe === tf ? 'bg-emerald-500 text-black shadow-emerald' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>{tf.toUpperCase()}</button>
                            ))}
                        </div>
                        {/* Indicator Toggles */}
                        <div className="flex bg-black/50 border border-white/10 rounded-lg p-1 gap-1 backdrop-blur-md">
                            <button onClick={() => setShowRSI(!showRSI)} className={`p-1.5 rounded transition-colors ${showRSI ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50' : 'text-slate-400 hover:text-white'}`} title="Toggle RSI">
                                <Activity size={16} />
                            </button>
                            <button onClick={() => setShowBB(!showBB)} className={`p-1.5 rounded transition-colors ${showBB ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'text-slate-400 hover:text-white'}`} title="Toggle Bollinger Bands">
                                <Layers size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className={`absolute top-20 left-4 z-10 flex flex-col gap-1 text-xs font-mono transition-opacity duration-200 ${legend ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex gap-2 bg-black/40 backdrop-blur px-2 py-1 rounded border border-white/5">
                        <span className="text-slate-400">O:</span><span style={{ color: legend?.color }}>{legend?.open}</span>
                        <span className="text-slate-400">H:</span><span style={{ color: legend?.color }}>{legend?.high}</span>
                        <span className="text-slate-400">L:</span><span style={{ color: legend?.color }}>{legend?.low}</span>
                        <span className="text-slate-400">C:</span><span style={{ color: legend?.color }}>{legend?.close}</span>
                    </div>
                    <div className="flex gap-2 px-2 mt-1">
                        {legend?.ma20 && <span style={{ color: MA20_COLOR }}>MA20: {legend.ma20}</span>}
                        {legend?.ma50 && <span style={{ color: MA50_COLOR }}>MA50: {legend.ma50}</span>}
                        {showBB && <span className="text-sky-400">BB (20, 2)</span>}
                    </div>
                </div>

                {loading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                        <Loader2 className="animate-spin text-emerald-500" size={32} />
                    </div>
                )}

                {/* Chart Div */}
                <div ref={chartContainerRef} className="w-full h-full" />

                {/* Watermark */}
                <div className="absolute bottom-4 right-4 text-[40px] font-black text-white/5 select-none pointer-events-none">
                    SHX.EXCHANGE
                </div>
            </div>

            {/* RSI Pane (Conditional) */}
            {showRSI && (
                <div className="relative w-full h-[150px] border border-white/5 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-sm">
                    <div className="absolute top-2 left-2 text-[10px] font-bold text-sky-400 z-10">RSI (14)</div>
                    <div ref={rsiContainerRef} className="w-full h-full" />
                </div>
            )}
        </div>
    );
};
