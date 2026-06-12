import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const JUP_RECURRING_URL = "https://api.jup.ag/recurring/v1";

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return { error: "Non-JSON response", text };
    }
}

const DCACreateSchema = z.object({
    action: z.enum(["create", "execute", "request-challenge", "verify-challenge", "register-vault"]),
    // For "create"
    user: z.string().optional(),
    inputMint: z.string().optional(),
    outputMint: z.string().optional(),
    inAmount: z.union([z.string(), z.number()]).optional(),
    numberOfOrders: z.union([z.string(), z.number()]).optional(),
    interval: z.union([z.string(), z.number()]).optional(),
    // For "execute"
    signedTransaction: z.string().optional(),
    requestId: z.string().optional(),
    // For Vault Auth
    wallet: z.string().optional(),
    signature: z.string().optional(),
    jwt: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const rateLimitResult = rateLimit(req, 30, 60000);
        if (!rateLimitResult.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const rawBody = await req.json();
        const parsedBody = DCACreateSchema.safeParse(rawBody);

        if (!parsedBody.success) {
            return NextResponse.json({ error: "Invalid request body", details: parsedBody.error.format() }, { status: 400 });
        }

        const body = parsedBody.data;
        const apiKey = process.env.JUPITER_API_KEY || "";
        if (!apiKey) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        // ─── ACTION: CREATE ───────────────────────────────────
        // Creates a DCA order and returns an unsigned transaction for the client to sign
        if (body.action === "create") {
            if (!body.user || !body.inputMint || !body.outputMint || !body.inAmount || !body.numberOfOrders || !body.interval) {
                return NextResponse.json({ error: "Missing required fields for DCA creation" }, { status: 400 });
            }

            // --- COMPLIANCE CHECK ---
            const { checkWalletRisk } = await import('@/lib/compliance');
            const risk = await checkWalletRisk(body.user);
            if (risk.isBlocked) {
                console.warn(`[Compliance] Blocked high-risk wallet in DCA API: ${body.user}`);
                return NextResponse.json({ error: "Address restricted by compliance policy" }, { status: 403 });
            }
            // ------------------------

            const orderPayload = {
                user: body.user,
                inputMint: body.inputMint,
                outputMint: body.outputMint,
                params: {
                    time: {
                        inAmount: parseInt(body.inAmount.toString()),
                        numberOfOrders: parseInt(body.numberOfOrders.toString()),
                        interval: parseInt(body.interval.toString()),
                        minPrice: null,
                        maxPrice: null,
                        startAt: null,
                    }
                }
            };

            console.log("[DCA API] Creating recurring order:", JSON.stringify(orderPayload));

            const response = await fetch(`${JUP_RECURRING_URL}/createOrder`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify(orderPayload),
            });

            const data = await safeJson(response);

            if (!response.ok) {
                console.error("[DCA API] Jupiter error:", data);
                return NextResponse.json(
                    { error: data.error || data.message || "Jupiter API error", details: data },
                    { status: response.status }
                );
            }

            // Jupiter returns { requestId, transaction (base64 unsigned) }
            console.log("[DCA API] Order crafted successfully, returning unsigned tx to client");
            return NextResponse.json({
                requestId: data.requestId,
                transaction: data.transaction,
            });
        }

        // ─── ACTION: EXECUTE ──────────────────────────────────
        // After the client signs the transaction, send it via Jupiter's execute endpoint
        if (body.action === "execute") {
            if (!body.signedTransaction || !body.requestId) {
                return NextResponse.json({ error: "Missing signedTransaction or requestId" }, { status: 400 });
            }

            const response = await fetch(`${JUP_RECURRING_URL}/execute`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify({
                    signedTransaction: body.signedTransaction,
                    requestId: body.requestId,
                }),
            });

            const data = await safeJson(response);

            if (!response.ok) {
                console.error("[DCA API] Execute error:", data);
                return NextResponse.json(
                    { error: data.error || data.message || "Execution failed", details: data },
                    { status: response.status }
                );
            }

            console.log("[DCA API] Order executed successfully");
            return NextResponse.json(data);
        }

        // ─── VAULT AUTH: REQUEST CHALLENGE ────────────────────────
        if (body.action === "request-challenge" && body.wallet) {
            const res = await fetch(`https://api.jup.ag/trigger/v2/auth/challenge`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey },
                body: JSON.stringify({ walletPubkey: body.wallet, type: "message" }),
            });
            const data = await safeJson(res);
            if (!res.ok) return NextResponse.json({ error: data.error || "Failed challenge" }, { status: res.status });
            return NextResponse.json(data);
        }

        // ─── VAULT AUTH: VERIFY CHALLENGE ─────────────────────────
        if (body.action === "verify-challenge" && body.wallet && body.signature) {
            const res = await fetch(`https://api.jup.ag/trigger/v2/auth/verify`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey },
                body: JSON.stringify({ type: "message", walletPubkey: body.wallet, signature: body.signature }),
            });
            const data = await safeJson(res);
            if (!res.ok) return NextResponse.json({ error: data.error || "Failed verify" }, { status: res.status });
            return NextResponse.json(data);
        }

        // ─── VAULT AUTH: REGISTER VAULT ─────────────────────────
        if (body.action === "register-vault" && body.jwt) {
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

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("[DCA API] Server error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
