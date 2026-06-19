import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import { z } from "zod";

const QuerySchema = z.object({
    user: z.string(),
});

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return { error: "Non-JSON response", text };
    }
}

export async function GET(req: NextRequest) {
    try {
        const rateLimitResult = await rateLimit(req, 30, 60000);
        if (!rateLimitResult.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const csrfCheck = validateInternalOrigin(req);
        if (!csrfCheck.success) {
            return NextResponse.json({ error: csrfCheck.error }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const user = searchParams.get("user");

        if (!user) {
            return NextResponse.json({ error: "User wallet parameter is required" }, { status: 400 });
        }

        const apiKey = process.env.JUPITER_API_KEY || "";
        if (!apiKey) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        // Fetch recurring orders for user
        const res = await fetch(`https://api.jup.ag/recurring/v1/getRecurringOrders?user=${user}`, {
            method: "GET",
            headers: {
                "x-api-key": apiKey,
            }
        });

        const data = await safeJson(res);

        if (!res.ok) {
            console.error("[DCA Orders API] Jupiter API Error:", data);
            return NextResponse.json({ error: data.error || data.message || "Failed to fetch DCA orders" }, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[DCA Orders API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
