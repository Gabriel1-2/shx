import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import { recordFee } from "@/lib/feeLedger";
import { getEffectiveFeeBps } from "@/lib/feeTiers";
import {
    adminAddVolume,
    adminHasOrderBeenProcessed,
    adminMarkOrderProcessed,
    decimalsForMint,
    estimateVolumeUsd,
} from "@/lib/adminUsers";

const apiKey = process.env.JUPITER_API_KEY || "";

/**
 * Sync filled limit orders into volume/fee ledger (Admin SDK).
 * Body: { wallet, jwt }
 */
export async function POST(req: NextRequest) {
    try {
        const rl = await rateLimit(req, 10, 60000);
        if (!rl.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const csrf = validateInternalOrigin(req);
        if (!csrf.success) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const body = await req.json();
        const { wallet, jwt } = body as { wallet?: string; jwt?: string };

        if (!wallet || !jwt) {
            return NextResponse.json({ error: "Wallet and JWT required" }, { status: 400 });
        }

        if (!apiKey) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        const res = await fetch(
            "https://api.jup.ag/trigger/v2/orders/history?state=past&limit=50",
            {
                method: "GET",
                headers: {
                    "x-api-key": apiKey,
                    Authorization: `Bearer ${jwt}`,
                },
            }
        );

        if (!res.ok) {
            console.error("[Limit Sync] Jupiter error:", await res.text());
            return NextResponse.json(
                { error: "Failed to fetch order history from Jupiter" },
                { status: 502 }
            );
        }

        const data = await res.json();
        const orders = data.orders || data.data || [];

        let syncedVolume = 0;
        let syncedCount = 0;

        for (const order of orders) {
            const state = (
                order.orderState ||
                order.status ||
                order.rawState ||
                ""
            ).toLowerCase();
            if (!["filled", "executed", "succeeded", "completed"].includes(state)) {
                continue;
            }

            const orderId = order.id || order.pubkey || order.orderPubkey || order.ocoId;
            if (!orderId) continue;

            const maker = order.maker || order.userPubkey || order.owner || order.user;
            if (maker && maker !== wallet) {
                console.warn(
                    `[Limit Sync] Wallet mismatch maker=${maker}, requested=${wallet}`
                );
                continue;
            }

            if (await adminHasOrderBeenProcessed(orderId)) continue;

            const inputMint = order.inputMint || order.makerMint || "";
            const inAmount = order.inAmount || order.inputAmount || order.makerAmount || "0";
            const decimals = decimalsForMint(inputMint);

            let volumeUsd = await estimateVolumeUsd(inputMint, inAmount, decimals);
            if (volumeUsd <= 0 && order.usdValue) volumeUsd = Number(order.usdValue);
            if (volumeUsd <= 0 && order.triggerPriceUsd && inputMint.includes("So1111")) {
                volumeUsd = (Number(inAmount) / 1e9) * Number(order.triggerPriceUsd);
            }
            if (volumeUsd <= 0) continue;

            await adminAddVolume(wallet, volumeUsd);
            await adminMarkOrderProcessed(orderId, wallet, volumeUsd);

            const outputMint = order.outputMint || order.takerMint || "";
            // Estimate platform fee for competition/referrals (tier default base if unknown)
            const feeBps = getEffectiveFeeBps(0, outputMint);
            const feeUsd = feeBps > 0 ? (volumeUsd * feeBps) / 10000 : 0;

            if (feeUsd > 0) {
                await recordFee({
                    id: `limit-${orderId}`,
                    wallet,
                    feeUsd,
                    feeBps,
                    volumeUsd,
                    source: "limit",
                    inputMint: inputMint || undefined,
                    outputMint: outputMint || undefined,
                });
            }

            try {
                const { adminCreditTradeReferral } = await import("@/lib/referralEngine");
                await adminCreditTradeReferral({
                    eventId: `limit-${orderId}`,
                    traderWallet: wallet,
                    feeUsd,
                    volumeUsd,
                    source: "limit",
                });
            } catch (e) {
                console.error("[Limit Sync] referral credit failed", e);
            }

            syncedVolume += volumeUsd;
            syncedCount++;
        }

        return NextResponse.json({ success: true, syncedCount, syncedVolume });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Server error";
        console.error("[Limit Sync] Error:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
