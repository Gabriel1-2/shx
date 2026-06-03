import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const JUP_API_KEY = process.env.JUPITER_API_KEY || "";
const JUP_RECURRING_URL = "https://api.jup.ag/recurring/v1/createOrder";

const DCASchema = z.object({
    user: z.string(),
    inputMint: z.string(),
    outputMint: z.string(),
    inAmount: z.union([z.string(), z.number()]),
    numberOfOrders: z.union([z.string(), z.number()]),
    interval: z.union([z.string(), z.number()]),
});

export async function POST(req: NextRequest) {
    try {
        const rateLimitResult = rateLimit(req, 20, 60000);
        if (!rateLimitResult.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const rawBody = await req.json();
        const parsedBody = DCASchema.safeParse(rawBody);

        if (!parsedBody.success) {
            return NextResponse.json({ error: "Invalid request body", details: parsedBody.error.format() }, { status: 400 });
        }

        const { user, inputMint, outputMint, inAmount, numberOfOrders, interval } = parsedBody.data;

        const apiKey = process.env.JUPITER_API_KEY || "";
        if (!apiKey) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        const orderPayload = {
            user,
            inputMint,
            outputMint,
            params: {
                time: {
                    inAmount: parseInt(inAmount.toString()),
                    numberOfOrders: parseInt(numberOfOrders.toString()),
                    interval: parseInt(interval.toString()),
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
                "x-api-key": apiKey,
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
