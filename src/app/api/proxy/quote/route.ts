import { NextRequest, NextResponse } from "next/server";

export const preferredRegion = "fra1"; // Force Frankfurt to bypass geo-blocking
export const runtime = "nodejs"; // MUST be nodejs to respect preferredRegion

const QUOTE_ENDPOINTS = [
    "https://lite-api.jup.ag/swap/v1/quote",
    "https://public.jupiterapi.com/quote"
];

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    let lastError = "Unknown Jupiter quote error";

    try {
        for (const endpoint of QUOTE_ENDPOINTS) {
            const jupUrl = `${endpoint}?${queryString}`;
            console.log(`[PROXY] Forwarding quote request to: ${jupUrl}`);

            const response = await fetch(jupUrl, {
                headers: {
                    "Content-Type": "application/json"
                },
                cache: "no-store"
            });

            if (!response.ok) {
                const errorText = await response.text();
                lastError = `${endpoint} -> ${response.status}: ${errorText}`;
                console.error(`[PROXY] Quote API Error: ${lastError}`);
                continue;
            }

            const data = await response.json();
            return NextResponse.json(data);
        }

        return NextResponse.json(
            { error: "Failed to fetch quote from Jupiter", details: lastError },
            { status: 502 }
        );
    } catch (error: unknown) {
        console.error("[PROXY] Internal Error:", error);
        return NextResponse.json({ error: "Internal Proxy Error", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
