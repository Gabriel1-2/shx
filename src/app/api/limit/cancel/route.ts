import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import { z } from "zod";

/**
 * Jupiter Trigger V2 cancel is two-step:
 * 1) POST /orders/price/cancel/{id} → { transaction, requestId }
 * 2) Sign withdrawal tx, POST /orders/price/confirm-cancel/{id}
 */
const BodySchema = z.object({
    action: z.enum(["initiate", "confirm"]).default("initiate"),
    wallet: z.string(),
    jwt: z.string(),
    orderId: z.string(),
    signedTransaction: z.string().optional(),
    cancelRequestId: z.string().optional(),
});

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { error: "Non-JSON response", text: text.slice(0, 500) };
    }
}

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
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        const authHeaders = {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            Authorization: `Bearer ${body.jwt}`,
        };

        if (body.action === "initiate") {
            const res = await fetch(
                `https://api.jup.ag/trigger/v2/orders/price/cancel/${body.orderId}`,
                { method: "POST", headers: authHeaders }
            );
            const data = await safeJson(res);
            if (!res.ok) {
                console.error("[Limit Cancel] initiate error:", data);
                return NextResponse.json(
                    { error: data.error || data.message || "Failed to cancel limit order" },
                    { status: res.status }
                );
            }
            // { id, transaction, requestId }
            return NextResponse.json(data);
        }

        if (body.action === "confirm") {
            if (!body.signedTransaction || !body.cancelRequestId) {
                return NextResponse.json(
                    { error: "signedTransaction and cancelRequestId required" },
                    { status: 400 }
                );
            }

            const res = await fetch(
                `https://api.jup.ag/trigger/v2/orders/price/confirm-cancel/${body.orderId}`,
                {
                    method: "POST",
                    headers: authHeaders,
                    body: JSON.stringify({
                        signedTransaction: body.signedTransaction,
                        cancelRequestId: body.cancelRequestId,
                    }),
                }
            );
            const data = await safeJson(res);
            if (!res.ok) {
                console.error("[Limit Cancel] confirm error:", data);
                return NextResponse.json(
                    { error: data.error || data.message || "Failed to confirm cancel" },
                    { status: res.status }
                );
            }
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Server error";
        console.error("[Limit Cancel API] Error:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
