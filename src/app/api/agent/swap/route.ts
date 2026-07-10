import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { recordFee } from "@/lib/feeLedger";

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
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
    try {
        const rateLimitResult = await rateLimit(req, 100, 60000); // 100 requests per minute
        if (!rateLimitResult.success) {
            return NextResponse.json({ error: "Too many requests. Agent rate limit exceeded." }, { status: 429, headers: corsHeaders() });
        }
    } catch (e) {
        // Fallback if rate limiter fails
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({
            error: "Invalid JSON body",
            expected: { signedTransaction: "base64 string", requestId: "string from /quote" },
        }, { status: 400, headers: corsHeaders() });
    }

    const { signedTransaction, requestId, agentPubkey } = body;

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
            // Track agent revenue share in the background if agentPubkey is provided
            if (agentPubkey && jupData.feeAmount > 0 && adminDb) {
                adminDb.collection("agent_referrals").add({
                    agentPubkey,
                    feeMint: jupData.feeMint,
                    feeAmount: jupData.feeAmount,
                    signature: jupData.signature,
                    inputMint: jupData.inputMint,
                    outputMint: jupData.outputMint,
                    inAmount: jupData.inAmount,
                    outAmount: jupData.outAmount,
                    timestamp: FieldValue.serverTimestamp(),
                }).catch(err => console.error("Failed to log agent referral", err));
            }

            // Record fee ledger using mint-aware pricing when possible
            if (jupData.feeAmount > 0 && jupData.signature) {
                (async () => {
                    try {
                        const { decimalsForMint, estimateVolumeUsd, adminAddVolume } = await import(
                            "@/lib/adminUsers"
                        );
                        const feeMint = jupData.feeMint || jupData.inputMint || "";
                        const decimals = decimalsForMint(feeMint);
                        let feeUsd = await estimateVolumeUsd(
                            feeMint,
                            jupData.feeAmount,
                            decimals
                        );
                        // Fallback: fee as fraction of notional if price missing
                        if (feeUsd <= 0 && jupData.inAmount && jupData.inputMint) {
                            const vol = await estimateVolumeUsd(
                                jupData.inputMint,
                                jupData.inAmount,
                                decimalsForMint(jupData.inputMint)
                            );
                            feeUsd = vol * 0.0065; // base tier approx
                        }
                        const volumeUsd =
                            jupData.inAmount && jupData.inputMint
                                ? await estimateVolumeUsd(
                                      jupData.inputMint,
                                      jupData.inAmount,
                                      decimalsForMint(jupData.inputMint)
                                  )
                                : feeUsd > 0
                                  ? (feeUsd * 10000) / 65
                                  : 0;

                        if (feeUsd > 0) {
                            await recordFee({
                                id: `agent-${jupData.signature}`,
                                wallet: agentPubkey || "unknown-agent",
                                feeUsd,
                                feeBps: 65,
                                volumeUsd,
                                source: "agent",
                                inputMint: jupData.inputMint,
                                outputMint: jupData.outputMint,
                            });
                        }
                        if (agentPubkey && volumeUsd > 0) {
                            await adminAddVolume(agentPubkey, volumeUsd);
                        }
                    } catch (err) {
                        console.error("[Agent] Fee ledger write failed:", err);
                    }
                })();
            }

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
