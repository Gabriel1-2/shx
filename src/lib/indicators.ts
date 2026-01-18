
import { CandleData } from "./chartData";

export interface LineData {
    time: number;
    value: number;
}

export interface BollingerData {
    time: number;
    upper: number;
    lower: number;
    middle: number;
}

/**
 * Calculates Simple Moving Average (SMA)
 * @param data Array of CandleData (must be sorted by time ascending)
 * @param period Number of periods (e.g. 20 for MA20)
 * @returns Array of LineData compatible with Lightweight Charts
 */
export function calculateSMA(data: CandleData[], period: number): LineData[] {
    if (data.length < period) return [];

    const smaData: LineData[] = [];
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const sum = slice.reduce((acc, candle) => acc + candle.close, 0);
        const avg = sum / period;
        smaData.push({ time: data[i].time, value: avg });
    }
    return smaData;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(data: CandleData[], period: number): LineData[] {
    if (data.length < period) return [];

    const k = 2 / (period + 1);
    const emaData: LineData[] = [];

    // Initial EMA is SMA
    const initialSlice = data.slice(0, period);
    const initialSum = initialSlice.reduce((acc, val) => acc + val.close, 0);
    let previousEMA = initialSum / period;

    emaData.push({ time: data[period - 1].time, value: previousEMA });

    for (let i = period; i < data.length; i++) {
        const currentClose = data[i].close;
        const currentEMA = (currentClose - previousEMA) * k + previousEMA;
        emaData.push({ time: data[i].time, value: currentEMA });
        previousEMA = currentEMA;
    }
    return emaData;
}

/**
 * Calculates Bollinger Bands
 * @param period Default 20
 * @param stdDevMultiplier Default 2.0
 */
export function calculateBollingerBands(data: CandleData[], period = 20, stdDevMultiplier = 2.0): BollingerData[] {
    if (data.length < period) return [];

    const bands: BollingerData[] = [];

    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);

        // SMA (Middle Band)
        const sum = slice.reduce((acc, c) => acc + c.close, 0);
        const sma = sum / period;

        // Standard Deviation
        const squaredDiffs = slice.map(c => Math.pow(c.close - sma, 2));
        const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
        const stdDev = Math.sqrt(avgSquaredDiff);

        bands.push({
            time: data[i].time,
            upper: sma + (stdDev * stdDevMultiplier),
            lower: sma - (stdDev * stdDevMultiplier),
            middle: sma
        });
    }
    return bands;
}

/**
 * Calculates RSI (Relative Strength Index)
 * @param period Default 14
 */
export function calculateRSI(data: CandleData[], period = 14): LineData[] {
    if (data.length < period + 1) return [];

    const rsiData: LineData[] = [];

    // Calculate initial average gain/loss
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) gains += change;
        else losses -= change; // abs value
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Push initial RSI
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - (100 / (1 + rs));
    rsiData.push({ time: data[period].time, value: rsi });

    // Wilder's Smoothing for subsequent values
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));

        rsiData.push({ time: data[i].time, value: rsi });
    }

    return rsiData;
}
