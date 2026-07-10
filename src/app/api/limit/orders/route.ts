import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import { z } from "zod";

const BodySchema = z.object({
    wallet: z.string(),
    jwt: z.string(),
    /** open | past | all — maps to Jupiter history filters */
    state: z.enum(["open", "past", "all"]).optional().default("open"),
});

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { error: "Non-JSON response", text: text.slice(0, 500) };
    }
}

const OPEN_STATES = new Set([
    "open",
    "active",
    "pending",
    "executing",
    "pending_withdraw",
    "ready_to_cancel",
    "failed",
]);

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

        const url = new URL("https://api.jup.ag/trigger/v2/orders/history");
        url.searchParams.set("limit", "50");
        if (body.state === "past") {
            url.searchParams.set("state", "past");
        }

        const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "x-api-key": apiKey,
                Authorization: `Bearer ${body.jwt}`,
            },
        });

        const data = await safeJson(res);
        if (!res.ok) {
            console.error("[Limit Orders API] Jupiter error:", data);
            return NextResponse.json(
                { error: data.error || data.message || "Failed to fetch limit orders", details: data },
                { status: res.status }
            );
        }

        let orders = data.orders || data.data || [];
        if (body.state === "open") {
            orders = orders.filter((o: Record<string, string>) => {
                const s = (o.orderState || o.status || o.rawState || "").toLowerCase();
                return OPEN_STATES.has(s) || s === "";
            });
        }

        return NextResponse.json({ orders });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Server error";
        console.error("[Limit Orders API] Error:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
