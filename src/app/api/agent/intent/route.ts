import { NextRequest, NextResponse } from "next/server";

// ─── Minimal Map for standard intent resolution ───────────────
const SYMBOL_MAP: Record<string, { mint: string; decimals: number }> = {
    "SOL":   { mint: "So11111111111111111111111111111111111111112", decimals: 9 },
    "USDC":  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
    "USDT":  { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
    "SHX":   { mint: "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q", decimals: 9 },
    "BONK":  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
    "WIF":   { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6 },
};

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "X-Powered-By": "SHX Exchange Agent API",
    };
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST /api/agent/intent
 * 
 * Takes a natural language intent string and resolves it into a trade.
 * For example: "Swap 10 USDC for SHX" or "Trade 0.5 SOL to BONK"
 */
export async function POST(req: NextRequest) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders() });
    }

    const { intent, taker, agentPubkey } = body;

    if (!intent || !taker) {
        return NextResponse.json({
            error: "Missing required fields",
            required: ["intent", "taker"],
            example: { intent: "Swap 50 USDC for SHX", taker: "YOUR_WALLET" }
        }, { status: 400, headers: corsHeaders() });
    }

    // Very basic NLP / Regex matcher for swaps
    // Matches: "Swap 10.5 USDC to SHX", "trade 5 sol for usdc"
    const swapRegex = /(?:swap|trade|buy|sell)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9_]+)\s+(?:for|to|with)\s+([A-Za-z0-9_]+)/i;
    
    const match = intent.match(swapRegex);
    if (!match) {
        return NextResponse.json({
            error: "Could not parse intent",
            reason: "Only simple swap intents are currently supported via regex.",
            hint: "Try 'Swap [amount] [symbol] for [symbol]'. For complex operations, manually resolve mints via /api/agent/resolve and construct a call to /api/agent/quote."
        }, { status: 422, headers: corsHeaders() });
    }

    const amountStr = match[1];
    const inputSymbol = match[2].toUpperCase();
    const outputSymbol = match[3].toUpperCase();

    const inputData = SYMBOL_MAP[inputSymbol];
    const outputData = SYMBOL_MAP[outputSymbol];

    if (!inputData || !outputData) {
        return NextResponse.json({
            error: "Unknown token symbol in intent",
            failedSymbols: [!inputData && inputSymbol, !outputData && outputSymbol].filter(Boolean),
            hint: "Please use exact mint addresses with /api/agent/quote if the symbol is not supported."
        }, { status: 422, headers: corsHeaders() });
    }

    // Convert to lamports
    const amountNum = parseFloat(amountStr);
    const amountLamports = Math.floor(amountNum * Math.pow(10, inputData.decimals)).toString();

    // Call our own /api/agent/quote endpoint
    try {
        const protocol = req.headers.get("x-forwarded-proto") || "http";
        const host = req.headers.get("host");
        const baseUrl = `${protocol}://${host}`;
        
        const quoteUrl = new URL(`${baseUrl}/api/agent/quote`);
        quoteUrl.searchParams.set("inputMint", inputData.mint);
        quoteUrl.searchParams.set("outputMint", outputData.mint);
        quoteUrl.searchParams.set("amount", amountLamports);
        quoteUrl.searchParams.set("taker", taker);
        if (agentPubkey) {
            quoteUrl.searchParams.set("agentPubkey", agentPubkey);
        }

        const quoteRes = await fetch(quoteUrl.toString());
        const quoteData = await quoteRes.json();

        if (!quoteRes.ok) {
            return NextResponse.json(quoteData, { status: quoteRes.status, headers: corsHeaders() });
        }

        // Return the resolved intent and the fully prepared quote
        return NextResponse.json({
            resolvedIntent: {
                action: "swap",
                inputMint: inputData.mint,
                outputMint: outputData.mint,
                amountUi: amountNum,
                amountLamports,
                taker
            },
            quote: quoteData
        }, { headers: corsHeaders() });

    } catch (err: any) {
        return NextResponse.json({
            error: "Failed to resolve quote internally",
            message: err.message
        }, { status: 500, headers: corsHeaders() });
    }
}
