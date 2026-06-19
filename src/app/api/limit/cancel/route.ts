import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import { z } from "zod";

const BodySchema = z.object({
    wallet: z.string(),
    jwt: z.string(),
    orderId: z.string(),
});

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return { error: "Non-JSON response", text };
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

        // Cancel order via Jupiter Trigger V2
        const res = await fetch(`https://api.jup.ag/trigger/v2/orders/price/cancel/${body.orderId}`, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "Authorization": `Bearer ${body.jwt}`
            }
        });

        const data = await safeJson(res);

        if (!res.ok) {
            console.error("[Limit Cancel API] Jupiter API Error:", data);
            return NextResponse.json({ error: data.error || data.message || "Failed to cancel limit order" }, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[Limit Cancel API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
