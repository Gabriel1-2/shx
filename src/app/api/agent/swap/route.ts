import { NextRequest, NextResponse } from "next/server";

// ─── CORS ─────────────────────────────────────────────────────
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        "X-Powered-By": "SHX Exchange Agent API",
    };
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST /api/agent/swap
 *
 * Execute a signed swap transaction via Jupiter Ultra.
 * The agent must have already:
 *   1. Called GET /api/agent/quote to get the unsigned transaction
 *   2. Signed it with their wallet
 *   3. Base64-encoded the signed transaction
 *
 * Body (JSON):
 *   - signedTransaction: base64-encoded signed transaction (required)
 *   - requestId:         from the quote response (required)
 */
export async function POST(req: NextRequest) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({
            error: "Invalid JSON body",
            expected: { signedTransaction: "base64 string", requestId: "string from /quote" },
        }, { status: 400, headers: corsHeaders() });
    }

    const { signedTransaction, requestId } = body;

    if (!signedTransaction || !requestId) {
        return NextResponse.json({
            error: "Missing required fields",
            required: ["signedTransaction", "requestId"],
            hint: "First call GET /api/agent/quote, sign the transaction, then POST here.",
        }, { status: 400, headers: corsHeaders() });
    }

    try {
        // Forward to Jupiter Ultra execute
        const jupRes = await fetch("https://api.jup.ag/ultra/v1/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                signedTransaction,
                requestId,
            }),
        });

        const jupData = await jupRes.json();

        if (jupData.status === "Success") {
            return NextResponse.json({
                status: "success",
                signature: jupData.signature,
                explorer: `https://solscan.io/tx/${jupData.signature}`,
                inputMint: jupData.inputMint,
                outputMint: jupData.outputMint,
                inAmount: jupData.inAmount,
                outAmount: jupData.outAmount,
                swapType: jupData.swapType,
                feeMint: jupData.feeMint,
                feeAmount: jupData.feeAmount,
            }, { headers: corsHeaders() });
        } else {
            return NextResponse.json({
                status: "failed",
                signature: jupData.signature,
                explorer: jupData.signature ? `https://solscan.io/tx/${jupData.signature}` : null,
                error: jupData.error || "Swap failed",
                rawResponse: jupData,
                _hint: "You can re-submit with the same signedTransaction + requestId to poll status (up to 2 minutes).",
            }, { status: 422, headers: corsHeaders() });
        }

    } catch (err: any) {
        return NextResponse.json({
            error: "Internal server error",
            message: err.message,
        }, { status: 500, headers: corsHeaders() });
    }
}
