import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import { recordFee } from "@/lib/feeLedger";
import {
    adminAddVolume,
    adminHasOrderBeenProcessed,
    adminMarkOrderProcessed,
    decimalsForMint,
    estimateVolumeUsd,
} from "@/lib/adminUsers";

const apiKey = process.env.JUPITER_API_KEY || "";

/**
 * Sync completed DCA cycles from Jupiter history into volume/fee ledger.
 * Body: { wallet }
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
        const wallet = body.wallet as string | undefined;
        if (!wallet) {
            return NextResponse.json({ error: "Wallet required" }, { status: 400 });
        }

        if (!apiKey) {
            return NextResponse.json({ error: "Jupiter API key not configured" }, { status: 500 });
        }

        // History includes completed/partial fills
        const url = new URL("https://api.jup.ag/recurring/v1/getRecurringOrders");
        url.searchParams.set("user", wallet);
        url.searchParams.set("orderStatus", "history");
        url.searchParams.set("recurringType", "time");
        url.searchParams.set("page", "1");

        const res = await fetch(url.toString(), {
            headers: { "x-api-key": apiKey },
        });

        if (!res.ok) {
            // Also try active for partial progress
            console.error("[DCA Sync] history fetch failed:", await res.text());
            return NextResponse.json({ success: true, syncedCount: 0, syncedVolume: 0, note: "history unavailable" });
        }

        const data = await res.json();
        const orders = data.orders || data.data || data.time || [];

        // Also pull active for partial fills
        const activeUrl = new URL("https://api.jup.ag/recurring/v1/getRecurringOrders");
        activeUrl.searchParams.set("user", wallet);
        activeUrl.searchParams.set("orderStatus", "active");
        activeUrl.searchParams.set("recurringType", "time");
        const activeRes = await fetch(activeUrl.toString(), {
            headers: { "x-api-key": apiKey },
        });
        if (activeRes.ok) {
            const activeData = await activeRes.json();
            const activeOrders = activeData.orders || activeData.data || activeData.time || [];
            orders.push(...activeOrders);
        }

        let syncedVolume = 0;
        let syncedCount = 0;

        for (const order of orders) {
            const orderId =
                order.publicKey ||
                order.orderAccount ||
                order.orderKey ||
                order.pubkey ||
                order.id;
            if (!orderId) continue;

            const maker = order.user || order.userKey || order.userPubkey || order.userAddress;
            if (maker && maker !== wallet) continue;

            // Prefer explicit filled count; fall back to completed cycles
            const filledCount =
                order.filledOrders ??
                order.ordersFilled ??
                order.state?.ordersFilled ??
                order.executedOrders ??
                0;

            if (!filledCount || filledCount <= 0) continue;

            // Credit each fill cycle once (incremental)
            for (let fill = 1; fill <= Number(filledCount); fill++) {
                const fillId = `dca-${orderId}-fill-${fill}`;
                if (await adminHasOrderBeenProcessed(fillId)) continue;

                const inputMint = order.inputMint || order.inMint || "";
                const rawPerOrder =
                    order.inAmountPerCycle ||
                    order.inAmountPerOrder ||
                    order.cycleInAmount ||
                    (order.inAmount && order.numberOfOrders
                        ? Math.floor(Number(order.inAmount) / Number(order.numberOfOrders))
                        : order.params?.time?.inAmount && order.params?.time?.numberOfOrders
                          ? Math.floor(
                                Number(order.params.time.inAmount) /
                                    Number(order.params.time.numberOfOrders)
                            )
                          : "0");

                const decimals = decimalsForMint(inputMint);
                let volumeUsd = await estimateVolumeUsd(inputMint, rawPerOrder, decimals);
                if (volumeUsd <= 0 && order.usdValue) {
                    volumeUsd = Number(order.usdValue) / Math.max(1, Number(filledCount));
                }
                if (volumeUsd <= 0) continue;

                await adminAddVolume(wallet, volumeUsd);
                await adminMarkOrderProcessed(fillId, wallet, volumeUsd);

                const outputMint = order.outputMint || order.outMint || "";
                // Jupiter Recurring charges ~0.1% — use that for referral competition accounting
                const feeBps = 10;
                const feeUsd = (volumeUsd * feeBps) / 10000;

                if (feeUsd > 0) {
                    await recordFee({
                        id: fillId,
                        wallet,
                        feeUsd,
                        feeBps,
                        volumeUsd,
                        source: "dca",
                        inputMint: inputMint || undefined,
                        outputMint: outputMint || undefined,
                    });
                }

                try {
                    const { adminCreditTradeReferral } = await import("@/lib/referralEngine");
                    await adminCreditTradeReferral({
                        eventId: fillId,
                        traderWallet: wallet,
                        feeUsd,
                        volumeUsd,
                        source: "dca",
                    });
                } catch (e) {
                    console.error("[DCA Sync] referral credit failed", e);
                }

                syncedVolume += volumeUsd;
                syncedCount++;
            }
        }

        return NextResponse.json({ success: true, syncedCount, syncedVolume });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Server error";
        console.error("[DCA Sync] Error:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
