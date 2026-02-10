import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Force Node.js runtime for stability

const DCA_API_BASES = [
    "https://dca-api.jup.ag/v1",
    "https://api.jup.ag/dca/v1"
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

// Helper to forward requests to Jupiter DCA API
async function forwardToJupiter(endpoint: string, method: string, body?: unknown) {
    let lastError = "Unknown DCA API error";

    try {
        for (const base of DCA_API_BASES) {
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
                console.error(`DCA Proxy Error (${endpoint}):`, lastError);
                continue;
            }

            const data = await response.json();
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: lastError }, { status: 502 });

    } catch (error: unknown) {
        console.error(`DCA Proxy Internal Error (${endpoint}):`, error);
        return NextResponse.json(
            { error: "Internal Proxy Error", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action");

        // dca-api.jup.ag/v1/create
        if (action === "create") {
            return await forwardToJupiter("create", "POST", body);
        }
        // dca-api.jup.ag/v1/close
        else if (action === "close") {
            return await forwardToJupiter("close", "POST", body);
        }
        else {
            // Default to create if no action specified (backward compatibility)
            return await forwardToJupiter("create", "POST", body);
        }
    } catch {
        return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    if (!wallet) return NextResponse.json({ error: "Missing wallet parameter" }, { status: 400 });

    // dca-api.jup.ag/v1/user?wallet=...
    return await forwardToJupiter(`user?wallet=${wallet}`, "GET");
}
