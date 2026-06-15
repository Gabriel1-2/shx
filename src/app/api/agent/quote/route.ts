import { NextRequest, NextResponse } from "next/server";

const SHX_MINT = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";
const REFERRAL_ACCOUNT = "9rvZ5CC86oFWgwej21DMPR83LSMBoDehrNe6v6V7AAeg";
const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";

// Fee tier table
const FEE_TIERS = [
    { minSHX: 500_000, feeBps: 50, label: "Diamond" },
    { minSHX: 100_000, feeBps: 52, label: "Platinum" },
    { minSHX: 50_000,  feeBps: 55, label: "Gold" },
    { minSHX: 10_000,  feeBps: 60, label: "Silver" },
    { minSHX: 0,       feeBps: 65, label: "Base" },
];

function getFeeTier(shxBalance: number) {
    for (const tier of FEE_TIERS) {
        if (shxBalance >= tier.minSHX) return tier;
    }
    return FEE_TIERS[FEE_TIERS.length - 1];
}

async function getSHXBalance(walletAddress: string): Promise<number> {
    try {
        const res = await fetch(HELIUS_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getTokenAccountsByOwner",
                params: [
                    walletAddress,
                    { mint: SHX_MINT },
                    { encoding: "jsonParsed" },
                ],
            }),
        });
        const data = await res.json();
        if (data.result?.value?.[0]) {
            return data.result.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        }
        return 0;
    } catch {
        return 0;
    }
}

// ─── CORS headers for all agent API responses ─────────────────────
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        "X-Powered-By": "SHX Exchange Agent API",
    };
}

// Handle preflight
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/agent/quote
 *
 * Get a swap quote from Jupiter Ultra with SHX fee calculation.
 * Returns the unsigned transaction + fee details for agent signing.
 *
 * Query params:
 *   - inputMint:  Token mint to sell (required)
 *   - outputMint: Token mint to buy (required)
 *   - amount:     Amount in smallest unit / lamports (required)
 *   - taker:      Agent wallet public key (required)
 */
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
    const rateLimitResult = rateLimit(req, 100, 60000); // 100 requests per minute
    if (!rateLimitResult.success) {
        return NextResponse.json({ error: "Too many requests. Agent rate limit exceeded." }, { status: 429, headers: corsHeaders() });
    }

    const { searchParams } = new URL(req.url);
    const inputMint = searchParams.get("inputMint");
    const outputMint = searchParams.get("outputMint");
    const amount = searchParams.get("amount");
    const taker = searchParams.get("taker");

    if (!inputMint || !outputMint || !amount || !taker) {
        return NextResponse.json({
            error: "Missing required parameters",
            required: ["inputMint", "outputMint", "amount", "taker"],
            example: "/api/agent/quote?inputMint=So111...&outputMint=EPjF...&amount=1000000000&taker=YOUR_WALLET",
        }, { status: 400, headers: corsHeaders() });
    }

    try {
        // 1. Get the agent's SHX balance to determine fee tier
        const shxBalance = await getSHXBalance(taker);
        const tier = getFeeTier(shxBalance);

        // 2. Determine effective fee (0% for SHX buys)
        const isBuyingSHX = outputMint === SHX_MINT;
        const effectiveFeeBps = isBuyingSHX ? 0 : tier.feeBps;

        // 3. Build Jupiter Ultra order request
        const jupiterParams = new URLSearchParams({
            inputMint,
            outputMint,
            amount,
            taker,
        });

        // Only add referral params when there's a fee
        if (effectiveFeeBps > 0) {
            jupiterParams.set("referralAccount", REFERRAL_ACCOUNT);
            jupiterParams.set("referralFee", effectiveFeeBps.toString());
        }

        const jupRes = await fetch(
            `https://api.jup.ag/ultra/v1/order?${jupiterParams.toString()}`
        );

        if (!jupRes.ok) {
            const errorText = await jupRes.text();
            return NextResponse.json({
                error: "Jupiter quote failed",
                jupiterStatus: jupRes.status,
                details: errorText,
            }, { status: jupRes.status, headers: corsHeaders() });
        }

        const jupData = await jupRes.json();

        // 4. Return enriched response
        return NextResponse.json({
            // Jupiter fields
            transaction: jupData.transaction,
            requestId: jupData.requestId,
            inputMint: jupData.inputMint || inputMint,
            outputMint: jupData.outputMint || outputMint,
            inAmount: jupData.inAmount,
            outAmount: jupData.outAmount,
            swapType: jupData.swapType,

            // SHX Exchange enrichment
            shx: {
                feeBps: effectiveFeeBps,
                feePercent: effectiveFeeBps / 100,
                tierLabel: isBuyingSHX ? "SHX Buy (0%)" : tier.label,
                shxBalance,
                isBuyingSHX,
                referralAccount: effectiveFeeBps > 0 ? REFERRAL_ACCOUNT : null,
            },

            // Agent instructions
            _instructions: {
                step1: "Deserialize the `transaction` field (base64) into a VersionedTransaction",
                step2: "Sign the transaction with your wallet keypair",
                step3: "Serialize and base64-encode the signed transaction",
                step4: "POST to /api/agent/swap with { signedTransaction, requestId }",
            },
        }, { headers: corsHeaders() });

    } catch (err: any) {
        return NextResponse.json({
            error: "Internal server error",
            message: err.message,
        }, { status: 500, headers: corsHeaders() });
    }
}
