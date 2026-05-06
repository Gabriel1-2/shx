import { NextResponse } from "next/server";

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
 * GET /api/agent/health
 *
 * Health check for the SHX Exchange Agent API.
 * Returns current status, available endpoints, and version info.
 */
export async function GET() {
    // Check Jupiter Ultra availability
    let jupiterStatus = "unknown";
    try {
        const res = await fetch("https://api.jup.ag/ultra/v1/order?inputMint=test", {
            signal: AbortSignal.timeout(3000),
        });
        // Jupiter will return 400 for bad params, which means it's up
        jupiterStatus = res.status === 400 || res.status === 200 ? "operational" : "degraded";
    } catch {
        jupiterStatus = "down";
    }

    return NextResponse.json({
        status: "operational",
        version: "1.0.0",
        name: "SHX Exchange Agent API",
        description: "Headless DEX — programmatic swap API for AI agents and bots on Solana",
        chain: "solana-mainnet",
        routingEngine: "Jupiter Ultra",

        jupiter: jupiterStatus,

        endpoints: {
            "GET /api/agent/health": "This endpoint — status and discovery",
            "GET /api/agent/quote": "Get a swap quote with auto fee calculation (params: inputMint, outputMint, amount, taker)",
            "POST /api/agent/swap": "Execute a signed swap (body: signedTransaction, requestId)",
            "GET /api/agent/tier": "Check wallet fee tier and SHX balance (params: wallet)",
            "GET /api/agent/tokens": "List supported tokens with live prices (optional: mint)",
        },

        feeTiers: [
            { label: "Base",     minSHX: 0,       feeBps: 65, feePercent: "0.65%" },
            { label: "Silver",   minSHX: 10_000,  feeBps: 60, feePercent: "0.60%" },
            { label: "Gold",     minSHX: 50_000,  feeBps: 55, feePercent: "0.55%" },
            { label: "Platinum", minSHX: 100_000, feeBps: 52, feePercent: "0.52%" },
            { label: "Diamond",  minSHX: 500_000, feeBps: 50, feePercent: "0.50%" },
        ],

        shxMint: "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q",
        buyingSHXFee: "0% (always free)",

        quickstart: {
            step1: "GET /api/agent/quote?inputMint=So111...&outputMint=EPjF...&amount=1000000000&taker=YOUR_WALLET",
            step2: "Deserialize response.transaction (base64), sign with your keypair",
            step3: "POST /api/agent/swap with { signedTransaction: '<base64>', requestId: '<from step 1>' }",
            step4: "Check response.signature for the on-chain transaction",
        },

        documentation: "/llms.txt",
        source: "https://github.com/Gabriel1-2/shx",
        timestamp: new Date().toISOString(),
    }, { headers: corsHeaders() });
}
