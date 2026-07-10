import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import { z } from "zod";

export const maxDuration = 60;

const JUP_RECURRING_URL = "https://api.jup.ag/recurring/v1";

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { error: "Non-JSON response", text: text.slice(0, 500) };
    }
}

function jupHeaders(apiKey: string, extra?: Record<string, string>) {
    return {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        ...extra,
    };
}

const DCACreateSchema = z.object({
    action: z.enum(["create", "execute"]),
    user: z.string().optional(),
    inputMint: z.string().optional(),
    outputMint: z.string().optional(),
    inAmount: z.union([z.string(), z.number()]).optional(),
    numberOfOrders: z.union([z.string(), z.number()]).optional(),
    interval: z.union([z.string(), z.number()]).optional(),
    minPrice: z.number().nullable().optional(),
    maxPrice: z.number().nullable().optional(),
    startAt: z.number().nullable().optional(),
    signedTransaction: z.string().optional(),
    requestId: z.string().optional(),
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

        const rawBody = await req.json();
        const parsedBody = DCACreateSchema.safeParse(rawBody);
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
                { error: "Jupiter API key not configured. Set JUPITER_API_KEY in env." },
                { status: 500 }
            );
        }

        // ─── CREATE: craft unsigned DCA tx ────────────────────
        if (body.action === "create") {
            if (
                !body.user ||
                !body.inputMint ||
                !body.outputMint ||
                body.inAmount == null ||
                body.numberOfOrders == null ||
                body.interval == null
            ) {
                return NextResponse.json(
                    {
                        error: "Missing required fields",
                        required: [
                            "user",
                            "inputMint",
                            "outputMint",
                            "inAmount",
                            "numberOfOrders",
                            "interval",
                        ],
                    },
                    { status: 400 }
                );
            }

            const { checkWalletRisk } = await import("@/lib/compliance");
            const risk = await checkWalletRisk(body.user);
            if (risk.isBlocked) {
                return NextResponse.json(
                    { error: "Address restricted by compliance policy" },
                    { status: 403 }
                );
            }

            // Jupiter Recurring createOrder shape (official docs)
            const orderPayload = {
                user: body.user,
                inputMint: body.inputMint,
                outputMint: body.outputMint,
                params: {
                    time: {
                        inAmount: parseInt(String(body.inAmount), 10),
                        numberOfOrders: parseInt(String(body.numberOfOrders), 10),
                        interval: parseInt(String(body.interval), 10),
                        minPrice: body.minPrice ?? null,
                        maxPrice: body.maxPrice ?? null,
                        startAt: body.startAt ?? null,
                    },
                },
            };

            console.log("[DCA API] createOrder:", JSON.stringify(orderPayload));

            const response = await fetch(`${JUP_RECURRING_URL}/createOrder`, {
                method: "POST",
                headers: jupHeaders(apiKey),
                body: JSON.stringify(orderPayload),
            });

            const data = await safeJson(response);
            if (!response.ok) {
                console.error("[DCA API] Jupiter create error:", data);
                return NextResponse.json(
                    {
                        error: data.error || data.message || "Jupiter createOrder failed",
                        details: data,
                    },
                    { status: response.status }
                );
            }

            // { requestId, transaction }
            return NextResponse.json({
                requestId: data.requestId,
                transaction: data.transaction,
            });
        }

        // ─── EXECUTE: submit signed tx via Jupiter ────────────
        if (body.action === "execute") {
            if (!body.signedTransaction || !body.requestId) {
                return NextResponse.json(
                    { error: "Missing signedTransaction or requestId" },
                    { status: 400 }
                );
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 55000);

            try {
                const response = await fetch(`${JUP_RECURRING_URL}/execute`, {
                    method: "POST",
                    headers: jupHeaders(apiKey),
                    body: JSON.stringify({
                        signedTransaction: body.signedTransaction,
                        requestId: body.requestId,
                    }),
                    signal: controller.signal,
                });

                const data = await safeJson(response);
                if (!response.ok) {
                    console.error("[DCA API] Execute error:", data);
                    return NextResponse.json(
                        {
                            error: data.error || data.message || "Execution failed",
                            details: data,
                        },
                        { status: response.status }
                    );
                }

                return NextResponse.json(data);
            } finally {
                clearTimeout(timeoutId);
            }
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Server error";
        console.error("[DCA API] Server error:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
