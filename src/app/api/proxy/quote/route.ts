import { NextRequest, NextResponse } from "next/server";

export const preferredRegion = "fra1"; // Force Frankfurt to bypass geo-blocking
export const runtime = "nodejs"; // MUST be nodejs to respect preferredRegion

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();

    try {
        const jupUrl = `https://quote-api.jup.ag/v6/quote?${queryString}`;
        console.log(`[PROXY] Forwarding quote request to: ${jupUrl}`);

        const response = await fetch(jupUrl, {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://jup.ag",
                "Referer": "https://jup.ag/"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[PROXY] Jupiter API Error: ${response.status} - ${errorText}`);
            return NextResponse.json({ error: "Failed to fetch quote from Jupiter", details: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[PROXY] Internal Error:", error);
        return NextResponse.json({ error: "Internal Proxy Error", details: error.message }, { status: 500 });
    }
}
