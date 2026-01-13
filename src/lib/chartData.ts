
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
 * GeckoTerminal groups data by POOL, not just Mint.
 * Strategy: Find the top liquidity pool for the token on Solana.
 */
async function getTopPool(tokenAddress: string): Promise<string | null> {
    try {
        const res = await fetch(`${BASE_URL}/networks/solana/tokens/${tokenAddress}/pools?page=1`);
        if (!res.ok) return null;
        const data = await res.json();
        const pools = data.data;
        if (!pools || pools.length === 0) return null;

        // Return the first pool's address (usually highest liquidity)
        return pools[0].attributes.address;
    } catch (e) {
        console.error("Failed to fetch pool", e);
        return null;
    }
}

export async function fetchOHLCV(tokenAddress: string, timeframe: "day" | "hour" | "minute" = "hour"): Promise<CandleData[]> {
    try {
        // 1. Get Pool Address (Cache this in prod!)
        // Note: For simple Swap pairs (SOL-USDC), we might hardcode or lookup.
        // For dynamic tokens, we fetch the top pool.
        const poolAddress = await getTopPool(tokenAddress);
        if (!poolAddress) return [];

        // 2. Map timeframe to API format
        // GeckoTerminal: day, hour, minute
        const resolution = timeframe;

        // 3. Fetch Data
        // Endpoint: /networks/{network}/pools/{pool_address}/ohlcv/{timeframe}
        const url = `${BASE_URL}/networks/solana/pools/${poolAddress}/ohlcv/${resolution}?limit=100`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("API Limit or Error");

        const json = await res.json();
        const rawData = json.data.attributes.ohlcv_list; // [[time, open, high, low, close, vol], ...]

        // 4. Format for Lightweight Charts
        // Library expects { time: number (seconds), open, high, low, close }
        return rawData.map((candle: number[]) => ({
            time: candle[0],
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4]
        })).reverse(); // API often returns desc, library usually likes asc (check this)

    } catch (e) {
        console.error("OHLCV Fetch Error", e);
        return [];
    }
}
