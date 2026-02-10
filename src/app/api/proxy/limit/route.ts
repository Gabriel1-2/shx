import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const LIMIT_API_BASES = [
    "https://lite-api.jup.ag/limit/v1",
    "https://jup.ag/api/limit/v1"
];

async function safeReadBody(response: Response): Promise<string> {
    const text = await response.text();
    if (!text) return "Empty upstream response";

    try {
        const json = JSON.parse(text) as { message?: string; error?: string };
        return json.message || json.error || text;
    } catch {
        return text;
    }
}

// Helper to forward requests to Jupiter Limit API
async function forwardToJupiter(endpoint: string, method: string, body?: unknown) {
    let lastError = "Unknown limit API error";

    try {
        for (const base of LIMIT_API_BASES) {
            const url = `${base}/${endpoint}`;
            const options: RequestInit = {
                method,
                headers: {
                    "Content-Type": "application/json"
                }
            };

            if (body && method !== "GET") {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(url, options);

            if (!response.ok) {
                const details = await safeReadBody(response);
                lastError = `${base} -> ${response.status}: ${details}`;
                console.error(`Limit Proxy Error (${endpoint}):`, lastError);
                continue;
            }

            const data = await response.json();
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: lastError }, { status: 502 });

    } catch (error: unknown) {
        console.error(`Limit Proxy Internal Error (${endpoint}):`, error);
        return NextResponse.json(
            { error: "Internal Proxy Error", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
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
    } catch {
        return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

    return await forwardToJupiter(`openOrders?wallet=${wallet}`, "GET");
}
