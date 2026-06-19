import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

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
        "request-challenge",
        "verify-challenge",
        "register-vault",
        "deposit-craft",
        "submit-order"
    ]),
    wallet: z.string().optional(),
    signature: z.string().optional(),
    jwt: z.string().optional(),
    
    // For deposit-craft
    inputMint: z.string().optional(),
    outputMint: z.string().optional(),
    inAmount: z.string().optional(),
    
    // For submit-order
    depositRequestId: z.string().optional(),
    signedTransaction: z.string().optional(),
    triggerPriceUsd: z.number().optional(),
    side: z.enum(["buy", "sell"]).optional(),
    expirySeconds: z.number().nullable().optional(), // null = never
});

export async function POST(req: NextRequest) {
    try {
        const rateLimitResult = await rateLimit(req, 30, 60000);
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

        // --- COMPLIANCE CHECK FOR ACTIONS INVOLVING A WALLET ---
        if (body.wallet && (body.action === "request-challenge" || body.action === "deposit-craft" || body.action === "submit-order")) {
            const { checkWalletRisk } = await import('@/lib/compliance');
            const risk = await checkWalletRisk(body.wallet);
            if (risk.isBlocked) {
                console.warn(`[Compliance] Blocked high-risk wallet in Limit API: ${body.wallet}`);
                return NextResponse.json({ error: "Address restricted by compliance policy" }, { status: 403 });
            }
        }
        // -------------------------------------------------------

        // 1. Request Challenge
        if (body.action === "request-challenge" && body.wallet) {
            const res = await fetch(`https://api.jup.ag/trigger/v2/auth/challenge`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey },
                body: JSON.stringify({ walletPubkey: body.wallet, type: "message" }),
            });
            const data = await safeJson(res);
            if (!res.ok) return NextResponse.json({ error: data.error || "Failed challenge" }, { status: res.status });
            return NextResponse.json(data);
        }

        // 2. Verify Challenge
        if (body.action === "verify-challenge" && body.wallet && body.signature) {
            const res = await fetch(`https://api.jup.ag/trigger/v2/auth/verify`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey },
                body: JSON.stringify({ type: "message", walletPubkey: body.wallet, signature: body.signature }),
            });
            const data = await safeJson(res);
            if (!res.ok) return NextResponse.json({ error: data.error || "Failed verify" }, { status: res.status });
            return NextResponse.json(data);
        }

        // 3. Register Vault
        if (body.action === "register-vault" && body.jwt) {
            // Note: Vault registration uses GET in Trigger V2
            const res = await fetch(`https://api.jup.ag/trigger/v2/vault/register`, {
                method: "GET", headers: { "x-api-key": apiKey, "Authorization": `Bearer ${body.jwt}` }
            });
            const data = await safeJson(res);
            if (!res.ok) {
                // If it's 409 Vault already registered, that's actually a success state for us!
                if (res.status === 409 && data.error === "Vault already registered") {
                    return NextResponse.json({ success: true, vault: data.details });
                }
                return NextResponse.json({ error: data.error || data.message || "Failed register", details: data }, { status: res.status });
            }
            return NextResponse.json({ success: true, vault: data });
        }

        // 4. Deposit Craft
        if (body.action === "deposit-craft" && body.wallet && body.jwt && body.inputMint && body.outputMint && body.inAmount) {
            const res = await fetch(`https://api.jup.ag/trigger/v2/deposit/craft`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "Authorization": `Bearer ${body.jwt}` },
                body: JSON.stringify({
                    userAddress: body.wallet,
                    inputMint: body.inputMint,
                    outputMint: body.outputMint,
                    amount: body.inAmount,
                    orderType: "price",
                    orderSubType: "single"
                })
            });
            const data = await safeJson(res);
            if (!res.ok) return NextResponse.json({ error: data.error || data.message || "Failed craft", details: data }, { status: res.status });
            return NextResponse.json(data);
        }

        // 5. Submit Order
        if (body.action === "submit-order" && body.jwt && body.wallet && body.depositRequestId && body.signedTransaction && body.inputMint && body.outputMint && body.inAmount && body.triggerPriceUsd) {
            // Determine trigger condition based on order side
            // Buy limit = trigger when price drops BELOW target
            // Sell limit = trigger when price rises ABOVE target
            const triggerCondition = body.side === "buy" ? "below" : "above";

            // Calculate expiry from user's selection (null = never → 1 year max)
            const expiryMs = body.expirySeconds != null
                ? body.expirySeconds * 1000
                : 365 * 24 * 60 * 60 * 1000; // Default 1 year if "Never"

            const orderPayload: Record<string, any> = {
                orderType: "single",
                depositRequestId: body.depositRequestId,
                depositSignedTx: body.signedTransaction,
                userPubkey: body.wallet,
                inputMint: body.inputMint,
                inputAmount: body.inAmount,
                outputMint: body.outputMint,
                triggerMint: body.side === "sell" ? body.inputMint : body.outputMint,
                expiresAt: Date.now() + expiryMs,
                triggerCondition,
                triggerPriceUsd: Number(body.triggerPriceUsd),
                slippageBps: 100, // 1% default slippage
            };

            console.log("[Limit API] Submitting order:", JSON.stringify(orderPayload));

            const res = await fetch(`https://api.jup.ag/trigger/v2/orders/price`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "Authorization": `Bearer ${body.jwt}` },
                body: JSON.stringify(orderPayload)
            });
            const data = await safeJson(res);
            if (!res.ok) {
                console.error("[Limit API] Submit error:", JSON.stringify(data));
                return NextResponse.json({ error: data.error || data.message || "Failed submit", details: data }, { status: res.status });
            }
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("[Limit API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
