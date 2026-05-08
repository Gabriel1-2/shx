import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/onramp/session
 * 
 * Creates a Stripe Crypto Onramp session.
 * The client_secret is returned to the frontend to mount the Stripe widget.
 * 
 * Required env: STRIPE_SECRET_KEY
 */
export async function POST(req: NextRequest) {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    if (!STRIPE_SECRET_KEY) {
        return NextResponse.json(
            { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to your environment." },
            { status: 503 }
        );
    }

    try {
        const body = await req.json();
        const { wallet_address, amount } = body;

        if (!wallet_address) {
            return NextResponse.json({ error: "wallet_address is required" }, { status: 400 });
        }

        // Create an Onramp Session via Stripe API
        const response = await fetch("https://api.stripe.com/v1/crypto/onramp_sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                "wallet_addresses[solana]": wallet_address,
                "source_currency": "usd",
                "destination_currency": "sol",
                "destination_network": "solana",
                ...(amount ? { "source_amount": amount.toString() } : {}),
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("[Stripe Onramp] Error creating session:", error);
            return NextResponse.json(
                { error: "Failed to create onramp session", details: error },
                { status: response.status }
            );
        }

        const session = await response.json();

        return NextResponse.json({
            client_secret: session.client_secret,
            session_id: session.id,
        });
    } catch (error) {
        console.error("[Stripe Onramp] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
