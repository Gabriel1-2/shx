import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import { z } from "zod";

export const maxDuration = 60;

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { error: "Non-JSON response", text: text.slice(0, 500) };
    }
}

const BodySchema = z.object({
    action: z.enum([
        "request-challenge",
        "verify-challenge",
        "register-vault",
        "get-vault",
        "deposit-craft",
        "submit-order",
    ]),
    wallet: z.string().optional(),
    signature: z.string().optional(),
    signedTransaction: z.string().optional(),
    jwt: z.string().optional(),
    inputMint: z.string().optional(),
    outputMint: z.string().optional(),
    inAmount: z.string().optional(),
    depositRequestId: z.string().optional(),
    triggerPriceUsd: z.number().optional(),
    side: z.enum(["buy", "sell"]).optional(),
    expirySeconds: z.number().nullable().optional(),
    slippageBps: z.number().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const rateLimitResult = await rateLimit(req, 30, 60000);
        if (!rateLimitResult.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const csrfCheck = validateInternalOrigin(req);
        if (!csrfCheck.success) {
            return NextResponse.json({ error: csrfCheck.error }, { status: 403 });
        }

        const parsedBody = BodySchema.safeParse(await req.json());
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: "Invalid request body", details: parsedBody.error.format() },
                { status: 400 }
            );
        }

        const body = parsedBody.data;
        const apiKey = process.env.JUPITER_API_KEY || "";
        if (!apiKey) {
            return NextResponse.json(
                { error: "Jupiter API key not configured. Set JUPITER_API_KEY." },
                { status: 500 }
            );
        }

        const jup = (path: string, init?: RequestInit) =>
            fetch(`https://api.jup.ag/trigger/v2${path}`, {
                ...init,
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    ...(init?.headers || {}),
                },
            });

        // Compliance on wallet-bound actions
        if (
            body.wallet &&
            (body.action === "request-challenge" ||
                body.action === "deposit-craft" ||
                body.action === "submit-order")
        ) {
            const { checkWalletRisk } = await import("@/lib/compliance");
            const risk = await checkWalletRisk(body.wallet);
            if (risk.isBlocked) {
                return NextResponse.json(
                    { error: "Address restricted by compliance policy" },
                    { status: 403 }
                );
            }
        }

        // 1. Challenge
        if (body.action === "request-challenge" && body.wallet) {
            const res = await jup("/auth/challenge", {
                method: "POST",
                body: JSON.stringify({ walletPubkey: body.wallet, type: "message" }),
            });
            const data = await safeJson(res);
            if (!res.ok) {
                return NextResponse.json(
                    { error: data.error || "Failed challenge" },
                    { status: res.status }
                );
            }
            return NextResponse.json(data);
        }

        // 2. Verify → JWT
        if (body.action === "verify-challenge" && body.wallet && body.signature) {
            const res = await jup("/auth/verify", {
                method: "POST",
                body: JSON.stringify({
                    type: "message",
                    walletPubkey: body.wallet,
                    signature: body.signature,
                }),
            });
            const data = await safeJson(res);
            if (!res.ok) {
                return NextResponse.json(
                    { error: data.error || "Failed verify" },
                    { status: res.status }
                );
            }
            return NextResponse.json(data); // { token }
        }

        // 3. Get vault
        if (body.action === "get-vault" && body.jwt) {
            const res = await jup("/vault", {
                method: "GET",
                headers: { Authorization: `Bearer ${body.jwt}` },
            });
            const data = await safeJson(res);
            if (!res.ok) {
                return NextResponse.json(
                    { error: data.error || "Vault not found", needsRegister: true },
                    { status: res.status }
                );
            }
            return NextResponse.json(data);
        }

        // 4. Register vault (GET per Jupiter docs)
        if (body.action === "register-vault" && body.jwt) {
            const res = await jup("/vault/register", {
                method: "GET",
                headers: { Authorization: `Bearer ${body.jwt}` },
            });
            const data = await safeJson(res);
            if (!res.ok) {
                if (res.status === 409 || data.error === "Vault already registered") {
                    return NextResponse.json({ success: true, vault: data.details || data });
                }
                return NextResponse.json(
                    { error: data.error || data.message || "Failed register", details: data },
                    { status: res.status }
                );
            }
            return NextResponse.json({ success: true, vault: data });
        }

        // 5. Deposit craft
        if (
            body.action === "deposit-craft" &&
            body.wallet &&
            body.jwt &&
            body.inputMint &&
            body.outputMint &&
            body.inAmount
        ) {
            const res = await jup("/deposit/craft", {
                method: "POST",
                headers: { Authorization: `Bearer ${body.jwt}` },
                body: JSON.stringify({
                    userAddress: body.wallet,
                    inputMint: body.inputMint,
                    outputMint: body.outputMint,
                    amount: body.inAmount,
                    orderType: "price",
                    orderSubType: "single",
                }),
            });
            const data = await safeJson(res);
            if (!res.ok) {
                return NextResponse.json(
                    { error: data.error || data.message || "Failed craft", details: data },
                    { status: res.status }
                );
            }
            return NextResponse.json(data); // { transaction, requestId, ... }
        }

        // 6. Submit single price order
        if (
            body.action === "submit-order" &&
            body.jwt &&
            body.wallet &&
            body.depositRequestId &&
            body.signedTransaction &&
            body.inputMint &&
            body.outputMint &&
            body.inAmount &&
            body.triggerPriceUsd != null &&
            body.side
        ) {
            const triggerCondition = body.side === "buy" ? "below" : "above";
            // Buy: monitoring output (base) price falling. Sell: monitoring input (base) rising.
            const triggerMint = body.side === "sell" ? body.inputMint : body.outputMint;

            const expiryMs =
                body.expirySeconds != null
                    ? body.expirySeconds * 1000
                    : 30 * 24 * 60 * 60 * 1000; // default 30d (V2 requires expiresAt)

            const orderPayload = {
                orderType: "single",
                depositRequestId: body.depositRequestId,
                depositSignedTx: body.signedTransaction,
                userPubkey: body.wallet,
                inputMint: body.inputMint,
                inputAmount: body.inAmount,
                outputMint: body.outputMint,
                triggerMint,
                expiresAt: Date.now() + expiryMs,
                triggerCondition,
                triggerPriceUsd: Number(body.triggerPriceUsd),
                slippageBps: body.slippageBps ?? 100,
            };

            console.log("[Limit API] Submitting order:", JSON.stringify({
                ...orderPayload,
                depositSignedTx: "[signed]",
            }));

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 55000);

            try {
                const res = await jup("/orders/price", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${body.jwt}` },
                    body: JSON.stringify(orderPayload),
                    signal: controller.signal,
                });

                const data = await safeJson(res);
                if (!res.ok) {
                    console.error("[Limit API] Submit error:", data);
                    return NextResponse.json(
                        { error: data.error || data.message || "Failed submit", details: data },
                        { status: res.status }
                    );
                }
                return NextResponse.json(data); // { id, txSignature }
            } finally {
                clearTimeout(timeoutId);
            }
        }

        return NextResponse.json({ error: "Invalid action or missing fields" }, { status: 400 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Server error";
        console.error("[Limit API] Error:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
