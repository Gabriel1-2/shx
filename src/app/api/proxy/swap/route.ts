
import { NextRequest, NextResponse } from "next/server";

export const preferredRegion = "fra1"; // Force Frankfurt to bypass geo-blocking
export const runtime = "nodejs"; // MUST be nodejs to respect preferredRegion

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Log the received body for debugging (optional, remove in prod if noisy)
        // console.log(`[PROXY] Forwarding swap request with platformFee:`, body.platformFee);

        // Forward to Jupiter Swap API (QuickNode Public)
        const response = await fetch("https://public.jupiterapi.com/swap", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://jup.ag",
                "Referer": "https://jup.ag/"
            },
            body: JSON.stringify(body) // Pass original body (now includes platformFee correctly)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[PROXY] Jupiter Swap API Error: ${response.status} - ${errorText} `);
            return NextResponse.json({ error: "Failed to construct swap transaction", details: errorText }, { status: response.status });
        }

        const data = await response.json();

        // Return Jupiter response directly (Frontend handles signing)
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("[PROXY] Internal Error:", error);
        return NextResponse.json({ error: "Internal Proxy Error", details: error.message }, { status: 500 });
    }
}
