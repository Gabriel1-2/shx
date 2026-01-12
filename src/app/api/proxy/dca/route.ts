import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Force Node.js runtime for stability

// Helper to forward requests to Jupiter DCA API
async function forwardToJupiter(endpoint: string, method: string, body?: any) {
    try {
        // Base URL for DCA is dca-api.jup.ag/v1
        const url = `https://dca-api.jup.ag/v1/${endpoint}`;
        const options: RequestInit = {
            method,
            headers: {
                "Content-Type": "application/json",
                // Mimic browser headers for potential CORS strictness on Jup backend
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
            console.error(`DCA Proxy Error (${endpoint}):`, response.status, errorText);
            // Try to parse JSON from upstream
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
        console.error(`DCA Proxy Internal Error (${endpoint}):`, error);
        return NextResponse.json({ error: "Internal Proxy Error" }, { status: 500 });
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
    } catch (error) {
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
