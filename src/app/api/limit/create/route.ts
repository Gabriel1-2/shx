import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const JUP_TRIGGER_BASE = "https://api.jup.ag/trigger/v2";

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return { error: "Non-JSON response", text };
    }
}

const BodySchema = z.object({
    action: z.enum([
        "request-challenge",  // Step 1: Get a challenge for wallet to sign
        "verify-challenge",   // Step 2: Submit signed challenge, get JWT
        "craft-deposit",      // Step 3: Craft unsigned deposit transaction
        "submit-order",       // Step 4: Submit signed deposit + order params
    ]),
    wallet: z.string().optional(),
    // For verify-challenge
    signature: z.string().optional(),
    challengeType: z.string().optional(),
    // For craft-deposit
    jwt: z.string().optional(),
    inputMint: z.string().optional(),
    outputMint: z.string().optional(),
    amount: z.string().optional(),
    orderSubType: z.string().optional(),
    // For submit-order
    depositRequestId: z.string().optional(),
    signedTransaction: z.string().optional(),
    orderParams: z.any().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const rateLimitResult = rateLimit(req, 20, 60000);
        if (!rateLimitResult.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const rawBody = await req.json();
        const parsedBody = BodySchema.safeParse(rawBody);

        if (!parsedBody.success) {
            return NextResponse.json({ error: "Invalid request body", details: parsedBody.error.format() }, { status: 400 });
        }

        const body = parsedBody.data;
        const apiKey = process.env.JUPITER_API_KEY || "";
        if (!apiKey) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        // --- COMPLIANCE CHECK ---
        if (body.wallet) {
            const { checkWalletRisk } = await import('@/lib/compliance');
            const risk = await checkWalletRisk(body.wallet);
            if (risk.isBlocked) {
                console.warn(`[Compliance] Blocked high-risk wallet in Limit API: ${body.wallet}`);
                return NextResponse.json({ error: "Address restricted by compliance policy" }, { status: 403 });
            }
        }
        // ------------------------

        // ─── STEP 1: REQUEST CHALLENGE ────────────────────────
        // Client calls this to get a challenge message for wallet to sign
        if (body.action === "request-challenge" && body.wallet) {
            console.log("[Limit API] Requesting challenge for wallet:", body.wallet.slice(0, 8));

            const res = await fetch(`${JUP_TRIGGER_BASE}/auth/challenge`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify({
                    walletPubkey: body.wallet,
                    type: "message",
                }),
            });

            const data = await safeJson(res);
            if (!res.ok) {
                console.error("[Limit API] Challenge error:", data);
                return NextResponse.json({ error: data.error || "Failed to get challenge" }, { status: res.status });
            }

            return NextResponse.json(data);
        }

        // ─── STEP 2: VERIFY CHALLENGE ─────────────────────────
        // Client signs the challenge, sends signature here. We exchange it for a JWT.
        if (body.action === "verify-challenge" && body.wallet && body.signature) {
            console.log("[Limit API] Verifying challenge for wallet:", body.wallet.slice(0, 8));

            const res = await fetch(`${JUP_TRIGGER_BASE}/auth/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify({
                    type: body.challengeType || "message",
                    walletPubkey: body.wallet,
                    signature: body.signature,
                }),
            });

            const data = await safeJson(res);
            if (!res.ok) {
                console.error("[Limit API] Verify error:", data);
                return NextResponse.json({ error: data.error || "Failed to verify challenge" }, { status: res.status });
            }

            // Returns { token: "jwt..." }
            return NextResponse.json(data);
        }

        // ─── STEP 3: CRAFT DEPOSIT ────────────────────────────
        // With JWT, craft the unsigned deposit transaction
        if (body.action === "craft-deposit" && body.wallet && body.inputMint && body.amount && body.jwt) {
            console.log("[Limit API] Crafting deposit for wallet:", body.wallet.slice(0, 8));

            let res = await fetch(`${JUP_TRIGGER_BASE}/deposit/craft`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "Authorization": `Bearer ${body.jwt}`,
                },
                body: JSON.stringify({
                    userAddress: body.wallet,
                    inputMint: body.inputMint,
                    outputMint: body.outputMint || "",
                    amount: body.amount,
                    orderType: "price",
                    orderSubType: body.orderSubType || "single",
                }),
            });

            let data = await safeJson(res);
            
            // --- VAULT AUTO-REGISTRATION ---
            if (!res.ok && data.error && data.error.toLowerCase().includes("vault")) {
                console.log("[Limit API] Vault not registered. Auto-registering...");
                const regRes = await fetch(`${JUP_TRIGGER_BASE}/vault/register`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": apiKey,
                        "Authorization": `Bearer ${body.jwt}`,
                    }
                });
                
                if (regRes.ok) {
                    console.log("[Limit API] Vault registered successfully. Retrying deposit craft...");
                    res = await fetch(`${JUP_TRIGGER_BASE}/deposit/craft`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-api-key": apiKey,
                            "Authorization": `Bearer ${body.jwt}`,
                        },
                        body: JSON.stringify({
                            userAddress: body.wallet,
                            inputMint: body.inputMint,
                            outputMint: body.outputMint || "",
                            amount: body.amount,
                            orderType: "price",
                            orderSubType: body.orderSubType || "single",
                        }),
                    });
                    data = await safeJson(res);
                } else {
                    const regData = await safeJson(regRes);
                    console.error("[Limit API] Failed to auto-register vault:", regData);
                }
            }
            // -------------------------------

            if (!res.ok) {
                console.error("[Limit API] Deposit craft error:", data);
                return NextResponse.json(
                    { error: data.error || data.message || "Failed to craft deposit", details: data },
                    { status: res.status }
                );
            }

            // Returns { transaction, requestId, receiverAddress, ... }
            console.log("[Limit API] Deposit crafted, returning unsigned tx");
            return NextResponse.json(data);
        }

        // ─── STEP 4: SUBMIT ORDER ─────────────────────────────
        // After client signs the deposit tx, submit the order
        if (body.action === "submit-order" && body.jwt) {
            console.log("[Limit API] Submitting order");

            const res = await fetch(`${JUP_TRIGGER_BASE}/orders/price`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "Authorization": `Bearer ${body.jwt}`,
                },
                body: JSON.stringify({
                    depositRequestId: body.depositRequestId,
                    signedTransaction: body.signedTransaction,
                    ...body.orderParams,
                }),
            });

            const data = await safeJson(res);
            if (!res.ok) {
                console.error("[Limit API] Order submission error:", data);
                return NextResponse.json({ error: data.error || "Failed to submit order", details: data }, { status: res.status });
            }

            console.log("[Limit API] Order created successfully");
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: "Invalid action or missing parameters" }, { status: 400 });
    } catch (error: any) {
        console.error("[Limit API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
