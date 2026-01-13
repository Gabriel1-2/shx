
// Utility to fetch Candle Data for Lightweight Charts
// Uses GeckoTerminal Public API
// Free Tier: Rate limits apply (~10/min potentially). Caching recommended if heavily used.

export interface CandleData {
    time: number; // UNIX timestamp (seconds)
    open: number;
    high: number;
    low: number;
    close: number;
}

const BASE_URL = "https://api.geckoterminal.com/api/v2";

/**
 * Fetch top pool for a token pair to get OHLCV data.
 * Strategy: 
 * 1. Try GeckoTerminal (Solana Network).
 * 2. Fallback to DexScreener to find the pair address, then map to Gecko.
 */
async function getTopPool(tokenAddress: string): Promise<string | null> {
    try {
        // 1. Try GeckoTerminal Direct Search
        const res = await fetch(`${BASE_URL}/networks/solana/tokens/${tokenAddress}/pools?page=1`);
        if (res.ok) {
            const data = await res.json();
            const pools = data.data;
            if (pools && pools.length > 0) return pools[0].attributes.address;
        }

        // 2. Fallback: DexScreener (Better indexing)
        console.log("Gecko search failed, trying DexScreener...");
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
        if (dexRes.ok) {
            const dexData = await dexRes.json();
            // Find best SOL pair
            const bestPair = dexData.pairs?.find((p: any) => p.chainId === 'solana' && p.quoteToken.symbol === 'SOL');
            if (bestPair) return bestPair.pairAddress;
            if (dexData.pairs?.length > 0) return dexData.pairs[0].pairAddress;
        }

        return null;
    } catch (e) {
        console.error("Failed to fetch pool", e);
        return null;
    }
}

export async function fetchOHLCV(tokenAddress: string, timeframe: "day" | "hour" | "minute" = "hour"): Promise<CandleData[]> {
    try {
        const CACHE_KEY = `ohlcv_${tokenAddress}_${timeframe}`;
        const CACHE_TTL = 5 * 60 * 1000; // 5 Minutes

        // 1. Check Cache
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_TTL) {
                    // console.log("Serving cached chart data");
                    return data;
                }
            }
        }

        // 2. Fetch Fresh Data
        // ... (API Logic) ...
        const poolAddress = await getTopPool(tokenAddress);
        if (!poolAddress) return [];

        const resolution = timeframe;
        const url = `${BASE_URL}/networks/solana/pools/${poolAddress}/ohlcv/${resolution}?limit=100`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("API Limit or Error");

        const json = await res.json();
        const rawData = json.data.attributes.ohlcv_list;

        const params = rawData.map((candle: number[]) => ({
            time: candle[0],
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4]
        })).reverse();

        // 3. Save to Cache
        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: params
            }));
        }

        return params;

    } catch (e) {
        console.error("OHLCV Fetch Error", e);
        // Fallback: Try to serve stale cache if API failed
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(`ohlcv_${tokenAddress}_${timeframe}`);
            if (cached) return JSON.parse(cached).data;
        }
        return [];
    }
}
