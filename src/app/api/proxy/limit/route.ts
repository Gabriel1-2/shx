import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Helper to forward requests to Jupiter Limit API
async function forwardToJupiter(endpoint: string, method: string, body?: any) {
    try {
        const url = `https://jup.ag/api/limit/v1/${endpoint}`;
        const options: RequestInit = {
            method,
            headers: {
                "Content-Type": "application/json",
                "Origin": "https://jup.ag",
                "Referer": "https://jup.ag/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        };

        if (body && method !== "GET") {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Limit Proxy Error (${endpoint}):`, response.status, errorText);
            // Try to parse JSON from upstream if possible
            let details = errorText;
            try {
                const json = JSON.parse(errorText);
                if (json.message) details = json.message;
                if (json.error) details = json.error;
            } catch (e) { }
            return NextResponse.json({ error: details }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error(`Limit Proxy Internal Error (${endpoint}):`, error);
        return NextResponse.json({ error: "Internal Proxy Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // Determine action based on body content or query param?
        // Actually, user hook calls specific endpoints.
        // We can use a query param `?action=create` or `?action=cancel`

        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action");

        if (action === "create") {
            return await forwardToJupiter("createOrder", "POST", body);
        } else if (action === "cancel") {
            return await forwardToJupiter("cancelOrders", "POST", body);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (e) {
        return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

    return await forwardToJupiter(`openOrders?wallet=${wallet}`, "GET");
}
