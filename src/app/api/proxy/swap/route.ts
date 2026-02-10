
import { NextRequest, NextResponse } from "next/server";

export const preferredRegion = "fra1"; // Force Frankfurt to bypass geo-blocking
export const runtime = "nodejs"; // MUST be nodejs to respect preferredRegion

const SWAP_ENDPOINTS = [
    "https://lite-api.jup.ag/swap/v1/swap",
    "https://public.jupiterapi.com/swap"
];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        let lastError = "Unknown Jupiter swap error";

        // Log the received body for debugging (optional, remove in prod if noisy)
        // console.log(`[PROXY] Forwarding swap request with platformFee:`, body.platformFee);

        for (const endpoint of SWAP_ENDPOINTS) {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                lastError = `${endpoint} -> ${response.status}: ${errorText}`;
                console.error(`[PROXY] Swap API Error: ${lastError}`);
                continue;
            }

            const data = await response.json();
            return NextResponse.json(data);
        }

        return NextResponse.json(
            { error: "Failed to construct swap transaction", details: lastError },
            { status: 502 }
        );

    } catch (error: unknown) {
        console.error("[PROXY] Internal Error:", error);
        return NextResponse.json({ error: "Internal Proxy Error", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
