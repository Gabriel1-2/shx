import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const JUP_TRIGGER_BASE = "https://api.jup.ag/trigger/v2";

const BodySchema = z.object({
    action: z.enum(["get-vault", "craft-deposit", "submit-order"]),
    wallet: z.string().optional(),
    inputMint: z.string().optional(),
    amount: z.string().optional(),
    orderType: z.string().optional(),
    orderSubType: z.string().optional(),
    depositRequestId: z.string().optional(),
    orderParams: z.any().optional(),
    jwt: z.string().optional(),
});

// Step 1: Get or register vault for a wallet
async function getOrCreateVault(walletPubkey: string) {
    const apiKey = process.env.JUPITER_API_KEY || "";
    const getRes = await fetch(`${JUP_TRIGGER_BASE}/vault?wallet=${walletPubkey}`, {
        headers: { "x-api-key": apiKey },
    });

    if (getRes.ok) {
        const data = await getRes.json();
        if (data?.vault) return data.vault;
    }

    const registerRes = await fetch(`${JUP_TRIGGER_BASE}/vault/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.JUPITER_API_KEY || "",
        },
        body: JSON.stringify({ wallet: walletPubkey }),
    });

    if (!registerRes.ok) {
        const err = await registerRes.json();
        throw new Error(`Vault registration failed: ${JSON.stringify(err)}`);
    }

    const registerData = await registerRes.json();
    return registerData.vault;
}

// Step 2: Craft deposit transaction
async function craftDeposit(params: {
    wallet: string;
    inputMint: string;
    amount: string;
    orderType: string;
    orderSubType: string;
}) {
    const res = await fetch(`${JUP_TRIGGER_BASE}/deposit/craft`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.JUPITER_API_KEY || "",
        },
        body: JSON.stringify({
            wallet: params.wallet,
            inputMint: params.inputMint,
            amount: params.amount,
            orderType: "price",
            orderSubType: params.orderSubType,
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Deposit craft failed: ${JSON.stringify(err)}`);
    }

    return await res.json();
}

export async function POST(req: NextRequest) {
    try {
        const rateLimitResult = rateLimit(req, 20, 60000);
        if (!rateLimitResult.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const rawBody = await req.json();
        const parsedBody = BodySchema.safeParse(rawBody);

        if (!parsedBody.success) {
            return NextResponse.json({ error: "Invalid request body", details: parsedBody.error.format() }, { status: 400 });
        }

        const body = parsedBody.data;
        const { action } = body;

        const apiKey = process.env.JUPITER_API_KEY || "";
        if (!apiKey) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        if (action === "get-vault" && body.wallet) {
            const vault = await getOrCreateVault(body.wallet);
            return NextResponse.json({ vault });
        }

        if (action === "craft-deposit" && body.wallet && body.inputMint && body.amount) {
            const deposit = await craftDeposit({
                wallet: body.wallet,
                inputMint: body.inputMint,
                amount: body.amount,
                orderType: body.orderType || "price",
                orderSubType: body.orderSubType || "single",
            });
            return NextResponse.json(deposit);
        }

        if (action === "submit-order") {
            const res = await fetch(`${JUP_TRIGGER_BASE}/orders/price`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.JUPITER_API_KEY || "",
                    ...(body.jwt ? { Authorization: `Bearer ${body.jwt}` } : {}),
                },
                body: JSON.stringify({
                    orderType: body.orderType || "single",
                    depositRequestId: body.depositRequestId,
                    ...body.orderParams,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                return NextResponse.json({ error: data }, { status: res.status });
            }
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: "Invalid action or missing parameters" }, { status: 400 });
    } catch (error: any) {
        console.error("[Limit API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
