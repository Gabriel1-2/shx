import { NextRequest, NextResponse } from "next/server";

const JUP_API_KEY = process.env.JUPITER_API_KEY || "";
const JUP_RECURRING_URL = "https://api.jup.ag/recurring/v1/createOrder";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { user, inputMint, outputMint, inAmount, numberOfOrders, interval } = body;

        if (!user || !inputMint || !outputMint || !inAmount || !numberOfOrders || !interval) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (!JUP_API_KEY) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        const orderPayload = {
            user,
            inputMint,
            outputMint,
            params: {
                time: {
                    inAmount: parseInt(inAmount),
                    numberOfOrders: parseInt(numberOfOrders),
                    interval: parseInt(interval),
                    minPrice: null,
                    maxPrice: null,
                    startAt: null,
                }
            }
        };

        console.log("[DCA API] Creating recurring order:", JSON.stringify(orderPayload));

        const response = await fetch(JUP_RECURRING_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": JUP_API_KEY,
            },
            body: JSON.stringify(orderPayload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("[DCA API] Jupiter error:", data);
            return NextResponse.json(
                { error: data.message || data.error || "Jupiter API error", details: data },
                { status: response.status }
            );
        }

        console.log("[DCA API] Order created successfully");
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[DCA API] Server error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
