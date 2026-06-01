import { NextRequest, NextResponse } from "next/server";

const JUP_API_KEY = process.env.JUPITER_API_KEY || "";

// Jupiter Trigger Order API v2 — multi-step flow
// Step 1: Get/register vault
// Step 2: Craft deposit tx
// Step 3: Submit signed order
const JUP_TRIGGER_BASE = "https://api.jup.ag/trigger/v2";

// Step 1: Get or register vault for a wallet
async function getOrCreateVault(walletPubkey: string) {
    // Try to get existing vault
    const getRes = await fetch(`${JUP_TRIGGER_BASE}/vault?wallet=${walletPubkey}`, {
        headers: { "x-api-key": JUP_API_KEY },
    });

    if (getRes.ok) {
        const data = await getRes.json();
        if (data?.vault) return data.vault;
    }

    // Register a new vault
    const registerRes = await fetch(`${JUP_TRIGGER_BASE}/vault/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": JUP_API_KEY,
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
            "x-api-key": JUP_API_KEY,
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
        const body = await req.json();
        const { action } = body;

        if (!JUP_API_KEY) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        // Action: get-vault — returns vault info for a wallet
        if (action === "get-vault") {
            const vault = await getOrCreateVault(body.wallet);
            return NextResponse.json({ vault });
        }

        // Action: craft-deposit — returns unsigned transaction for deposit
        if (action === "craft-deposit") {
            const deposit = await craftDeposit({
                wallet: body.wallet,
                inputMint: body.inputMint,
                amount: body.amount,
                orderType: body.orderType || "price",
                orderSubType: body.orderSubType || "single",
            });
            return NextResponse.json(deposit);
        }

        // Action: submit-order — submit the signed order
        if (action === "submit-order") {
            const res = await fetch(`${JUP_TRIGGER_BASE}/orders/price`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": JUP_API_KEY,
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

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("[Limit API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
