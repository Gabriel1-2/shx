import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";

async function safeJson(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { error: "Non-JSON response", text: text.slice(0, 500) };
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
        const orderStatus = searchParams.get("orderStatus") || "active";
        const page = searchParams.get("page") || "1";

        if (!user) {
            return NextResponse.json({ error: "User wallet parameter is required" }, { status: 400 });
        }

        const apiKey = process.env.JUPITER_API_KEY || "";
        if (!apiKey) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        // Official: getRecurringOrders — recurringType=time, orderStatus=active|history
        const url = new URL("https://api.jup.ag/recurring/v1/getRecurringOrders");
        url.searchParams.set("user", user);
        url.searchParams.set("orderStatus", orderStatus);
        url.searchParams.set("recurringType", "time");
        url.searchParams.set("includeFailedTx", "true");
        url.searchParams.set("page", page);

        const res = await fetch(url.toString(), {
            method: "GET",
            headers: { "x-api-key": apiKey },
        });

        const data = await safeJson(res);
        if (!res.ok) {
            console.error("[DCA Orders API] Jupiter error:", data);
            return NextResponse.json(
                { error: data.error || data.message || "Failed to fetch DCA orders" },
                { status: res.status }
            );
        }

        // Normalize to { orders: [...] } for the UI
        const orders =
            data.orders ||
            data.data ||
            data.all ||
            data.time ||
            (Array.isArray(data) ? data : []);

        return NextResponse.json({ orders, raw: data });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Server error";
        console.error("[DCA Orders API] Error:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
