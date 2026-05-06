import { NextRequest, NextResponse } from "next/server";

const COINGECKO_IDS: Record<string, string> = {
    "So11111111111111111111111111111111111111112": "solana",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "usd-coin",
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "bonk",
    "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": "dogwifcoin",
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "jupiter-exchange-solana",
};

const DEFAULT_TOKENS = [
    {
        symbol: "SHX",
        name: "Shulevitz",
        mint: "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q",
        decimals: 9,
    },
    {
        symbol: "SOL",
        name: "Solana",
        mint: "So11111111111111111111111111111111111111112",
        decimals: 9,
    },
    {
        symbol: "USDC",
        name: "USD Coin",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        decimals: 6,
    },
    {
        symbol: "BONK",
        name: "Bonk",
        mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        decimals: 5,
    },
    {
        symbol: "WIF",
        name: "dogwifhat",
        mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
        decimals: 6,
    },
    {
        symbol: "JUP",
        name: "Jupiter",
        mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
        decimals: 6,
    },
];

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        "X-Powered-By": "SHX Exchange Agent API",
        "Cache-Control": "public, max-age=30, s-maxage=30",
    };
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/agent/tokens
 *
 * Returns the supported token list with live prices.
 * Optional query: ?mint=<SPECIFIC_MINT> to get price for one token.
 */
export async function GET(req: NextRequest) {
    const specificMint = new URL(req.url).searchParams.get("mint");

    try {
        // Fetch CoinGecko prices for known tokens
        const cgIds = Object.values(COINGECKO_IDS).join(",");
        let cgPrices: Record<string, { usd: number; usd_24h_change?: number }> = {};

        try {
            const cgRes = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=usd&include_24hr_change=true`,
                { next: { revalidate: 30 } }
            );
            cgPrices = await cgRes.json();
        } catch {
            // CoinGecko may rate limit, continue with DexScreener
        }

        // If specific mint requested
        if (specificMint) {
            const token = DEFAULT_TOKENS.find(t => t.mint === specificMint);
            const cgId = COINGECKO_IDS[specificMint];
            let price = cgId && cgPrices[cgId] ? cgPrices[cgId].usd : 0;
            let change24h = cgId && cgPrices[cgId] ? cgPrices[cgId].usd_24h_change || 0 : 0;

            // Fallback to DexScreener
            if (!price) {
                try {
                    const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${specificMint}`);
                    const dsData = await dsRes.json();
                    if (dsData.pairs?.length > 0) {
                        const best = [...dsData.pairs].sort(
                            (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
                        )[0];
                        price = parseFloat(best.priceUsd) || 0;
                        change24h = best.priceChange?.h24 || 0;
                    }
                } catch { /* skip */ }
            }

            return NextResponse.json({
                mint: specificMint,
                symbol: token?.symbol || "UNKNOWN",
                name: token?.name || "Unknown Token",
                decimals: token?.decimals,
                price,
                change24h,
            }, { headers: corsHeaders() });
        }

        // Return all default tokens with prices
        const tokens = await Promise.all(
            DEFAULT_TOKENS.map(async (token) => {
                const cgId = COINGECKO_IDS[token.mint];
                let price = cgId && cgPrices[cgId] ? cgPrices[cgId].usd : 0;
                let change24h = cgId && cgPrices[cgId] ? cgPrices[cgId].usd_24h_change || 0 : 0;

                // Fallback for tokens not in CoinGecko (like SHX)
                if (!price) {
                    try {
                        const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mint}`);
                        const dsData = await dsRes.json();
                        if (dsData.pairs?.length > 0) {
                            const best = [...dsData.pairs].sort(
                                (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
                            )[0];
                            price = parseFloat(best.priceUsd) || 0;
                            change24h = best.priceChange?.h24 || 0;
                        }
                    } catch { /* skip */ }
                }

                return {
                    ...token,
                    price,
                    change24h,
                };
            })
        );

        return NextResponse.json({
            count: tokens.length,
            tokens,
            _note: "Any SPL token mint can be used for swaps — this list shows default watchlist tokens with live prices.",
        }, { headers: corsHeaders() });

    } catch (err: any) {
        return NextResponse.json({
            error: "Failed to fetch token data",
            message: err.message,
        }, { status: 500, headers: corsHeaders() });
    }
}
