import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import { z } from "zod";

const BodySchema = z.object({
    action: z.enum(["cancel", "execute"]).default("cancel"),
    user: z.string(),
    orderAccount: z.string().optional(),
    signedTransaction: z.string().optional(),
    requestId: z.string().optional(),
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

        // Craft cancel transaction
        if (body.action === "cancel") {
            if (!body.orderAccount) {
                return NextResponse.json({ error: "orderAccount required" }, { status: 400 });
            }

            const res = await fetch("https://api.jup.ag/recurring/v1/cancelOrder", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify({
                    order: body.orderAccount,
                    user: body.user,
                    recurringType: "time",
                }),
            });

            const data = await safeJson(res);
            if (!res.ok) {
                console.error("[DCA Cancel] Jupiter error:", data);
                return NextResponse.json(
                    { error: data.error || data.message || "Failed to cancel DCA order" },
                    { status: res.status }
                );
            }

            // { requestId, transaction } — client signs, then optionally calls execute
            return NextResponse.json(data);
        }

        // Optional: land via Jupiter execute
        if (body.action === "execute") {
            if (!body.signedTransaction || !body.requestId) {
                return NextResponse.json(
                    { error: "signedTransaction and requestId required" },
                    { status: 400 }
                );
            }

            const res = await fetch("https://api.jup.ag/recurring/v1/execute", {
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

            const data = await safeJson(res);
            if (!res.ok) {
                return NextResponse.json(
                    { error: data.error || data.message || "Execute failed" },
                    { status: res.status }
                );
            }
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Server error";
        console.error("[DCA Cancel API] Error:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
