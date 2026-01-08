import { NextRequest, NextResponse } from "next/server";

export const preferredRegion = "fra1"; // Force Frankfurt to bypass geo-blocking
export const runtime = "edge"; // Use Edge for lower latency

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();

    try {
        const jupUrl = `https://quote-api.jup.ag/v6/quote?${queryString}`;
        console.log(`[PROXY] Forwarding quote request to: ${jupUrl}`);

        const response = await fetch(jupUrl, {
            headers: {
                "Content-Type": "application/json",
                // Mimic a backend request
                "User-Agent": "SHX-Exchange-Proxy/1.0"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[PROXY] Jupiter API Error: ${response.status} - ${errorText}`);
            return NextResponse.json({ error: "Failed to fetch quote from Jupiter" }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("[PROXY] Internal Error:", error);
        return NextResponse.json({ error: "Internal Proxy Error" }, { status: 500 });
    }
}
