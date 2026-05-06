import { NextRequest, NextResponse } from "next/server";

const SHX_MINT = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=e36d269b-1bf1-4c2a-9efd-47d319ca4882";

const FEE_TIERS = [
    { tier: 4, minSHX: 500_000, feeBps: 50, feePercent: 0.50, label: "Diamond",  color: "#a855f7" },
    { tier: 3, minSHX: 100_000, feeBps: 52, feePercent: 0.52, label: "Platinum", color: "#06b6d4" },
    { tier: 2, minSHX: 50_000,  feeBps: 55, feePercent: 0.55, label: "Gold",     color: "#eab308" },
    { tier: 1, minSHX: 10_000,  feeBps: 60, feePercent: 0.60, label: "Silver",   color: "#94a3b8" },
    { tier: 0, minSHX: 0,       feeBps: 65, feePercent: 0.65, label: "Base",     color: "#6b7280" },
];

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        "X-Powered-By": "SHX Exchange Agent API",
    };
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/agent/tier?wallet=<WALLET_ADDRESS>
 *
 * Returns the wallet's SHX balance, fee tier, and savings info.
 * Use this to determine what fee will apply before requesting a quote.
 */
export async function GET(req: NextRequest) {
    const wallet = new URL(req.url).searchParams.get("wallet");

    if (!wallet) {
        return NextResponse.json({
            error: "Missing 'wallet' query parameter",
            example: "/api/agent/tier?wallet=YOUR_WALLET_ADDRESS",
        }, { status: 400, headers: corsHeaders() });
    }

    try {
        // Fetch SHX balance via RPC
        const rpcRes = await fetch(HELIUS_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getTokenAccountsByOwner",
                params: [
                    wallet,
                    { mint: SHX_MINT },
                    { encoding: "jsonParsed" },
                ],
            }),
        });

        const rpcData = await rpcRes.json();
        let shxBalance = 0;
        if (rpcData.result?.value?.[0]) {
            shxBalance = rpcData.result.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        }

        // Determine tier
        let currentTier = FEE_TIERS[FEE_TIERS.length - 1]; // Base
        for (const tier of FEE_TIERS) {
            if (shxBalance >= tier.minSHX) {
                currentTier = tier;
                break;
            }
        }

        // Next tier
        const currentIdx = FEE_TIERS.findIndex(t => t.tier === currentTier.tier);
        const nextTier = currentIdx > 0 ? FEE_TIERS[currentIdx - 1] : null;
        const shxNeeded = nextTier ? Math.max(0, nextTier.minSHX - shxBalance) : 0;

        const baseFee = FEE_TIERS[FEE_TIERS.length - 1]; // Base tier

        return NextResponse.json({
            wallet,
            shxBalance,
            shxMint: SHX_MINT,

            currentTier: {
                tier: currentTier.tier,
                label: currentTier.label,
                feeBps: currentTier.feeBps,
                feePercent: currentTier.feePercent,
                color: currentTier.color,
            },

            nextTier: nextTier ? {
                tier: nextTier.tier,
                label: nextTier.label,
                feeBps: nextTier.feeBps,
                feePercent: nextTier.feePercent,
                shxNeeded,
            } : null,

            savings: {
                vsBaseTier: `${(baseFee.feePercent - currentTier.feePercent).toFixed(2)}%`,
                buyingSHXFee: "0% (always free)",
            },

            allTiers: FEE_TIERS.map(t => ({
                tier: t.tier,
                label: t.label,
                minSHX: t.minSHX,
                feeBps: t.feeBps,
                feePercent: t.feePercent,
            })).reverse(),

        }, { headers: corsHeaders() });

    } catch (err: any) {
        return NextResponse.json({
            error: "Failed to fetch wallet data",
            message: err.message,
        }, { status: 500, headers: corsHeaders() });
    }
}
