import { NextRequest, NextResponse } from "next/server";

export const preferredRegion = "fra1"; // Force Frankfurt to bypass geo-blocking
export const runtime = "edge"; // Use Edge for lower latency

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log(`[PROXY] Forwarding swap construction request...`);

        // Forward to Jupiter Swap API
        const response = await fetch("https://quote-api.jup.ag/v6/swap", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "SHX-Exchange-Proxy/1.0"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[PROXY] Jupiter Swap API Error: ${response.status} - ${errorText}`);
            return NextResponse.json({ error: "Failed to construct swap transaction" }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("[PROXY] Internal Error:", error);
        return NextResponse.json({ error: "Internal Proxy Error" }, { status: 500 });
    }
}
