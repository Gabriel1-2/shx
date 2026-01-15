
import { CandleData } from "./chartData";

export interface LineData {
    time: number;
    value: number;
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

        smaData.push({
            time: data[i].time,
            value: avg
        });
    }

    return smaData;
}
