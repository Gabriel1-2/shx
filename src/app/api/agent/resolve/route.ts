import { NextRequest, NextResponse } from "next/server";

// ─── Comprehensive symbol → mint resolver ─────────────────────
const SYMBOL_MAP: Record<string, { mint: string; decimals: number; name: string }> = {
    "SOL":   { mint: "So11111111111111111111111111111111111111112", decimals: 9, name: "Solana" },
    "USDC":  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, name: "USD Coin" },
    "USDT":  { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, name: "Tether" },
    "SHX":   { mint: "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q", decimals: 9, name: "Shulevitz" },
    "BONK":  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, name: "Bonk" },
    "WIF":   { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, name: "dogwifhat" },
    "JUP":   { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, name: "Jupiter" },
    "RAY":   { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, name: "Raydium" },
    "ORCA":  { mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6, name: "Orca" },
    "PYTH":  { mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, name: "Pyth Network" },
    "WSOL":  { mint: "So11111111111111111111111111111111111111112", decimals: 9, name: "Wrapped SOL" },
    "WBTC":  { mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8, name: "Wrapped BTC (Wormhole)" },
    "WETH":  { mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, name: "Wrapped ETH (Wormhole)" },
};

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "X-Powered-By": "SHX Exchange Agent API",
    };
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/agent/resolve?symbol=SOL
 * GET /api/agent/resolve?symbol=SOL,USDC,SHX
 * GET /api/agent/resolve (returns all)
 *
 * Resolves human-readable token symbols to Solana mint addresses.
 * Agents can use this instead of hardcoding mint addresses.
 */
export async function GET(req: NextRequest) {
    const symbolParam = new URL(req.url).searchParams.get("symbol");

    if (!symbolParam) {
        // Return full map
        return NextResponse.json({
            count: Object.keys(SYMBOL_MAP).length,
            tokens: SYMBOL_MAP,
            _hint: "Pass ?symbol=SOL or ?symbol=SOL,USDC,SHX to resolve specific tokens",
        }, { headers: corsHeaders() });
    }

    const symbols = symbolParam.toUpperCase().split(",").map(s => s.trim());
    const results: Record<string, any> = {};
    const notFound: string[] = [];

    for (const sym of symbols) {
        if (SYMBOL_MAP[sym]) {
            results[sym] = SYMBOL_MAP[sym];
        } else {
            notFound.push(sym);
        }
    }

    // If a single symbol was requested and not found, try Jupiter search
    if (symbols.length === 1 && notFound.length === 1) {
        try {
            const searchRes = await fetch(
                `https://api.jup.ag/ultra/v1/search?query=${symbols[0]}`
            );
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.length > 0) {
                    const token = searchData[0];
                    results[symbols[0]] = {
                        mint: token.address,
                        decimals: token.decimals,
                        name: token.name,
                        source: "jupiter_search",
                    };
                    notFound.pop();
                }
            }
        } catch { /* skip */ }
    }

    return NextResponse.json({
        resolved: results,
        notFound: notFound.length > 0 ? notFound : undefined,
        _hint: notFound.length > 0
            ? "Unknown symbols can be passed as raw mint addresses to /api/agent/quote"
            : undefined,
    }, { headers: corsHeaders() });
}
