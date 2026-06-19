import { NextResponse } from "next/server";
import { addVolume, hasOrderBeenProcessed, markOrderProcessed } from "@/lib/points";
import { recordFee } from "@/lib/feeLedger";
import { getEffectiveFeeBps } from "@/lib/feeTiers";

const apiKey = process.env.JUPITER_API_KEY || "";
const JUP_RECURRING_URL = "https://api.jup.ag/recurring/v1";

/**
 * Sync past DCA sub-orders from Jupiter to track volume and fees asynchronously.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { wallet, jwt } = body;

        if (!wallet || !jwt) {
            return NextResponse.json({ error: "Wallet and JWT required" }, { status: 400 });
        }

        const res = await fetch(`${JUP_RECURRING_URL}/orders?user=${wallet}`, {
            method: "GET",
            headers: {
                "x-api-key": apiKey,
                "Authorization": `Bearer ${jwt}`
            }
        });

        if (!res.ok) {
            console.error("[DCA Sync] Jupiter API Error:", await res.text());
            return NextResponse.json({ error: "Failed to fetch DCA orders from Jupiter" }, { status: 502 });
        }

        const data = await res.json();
        const orders = data.orders || data.data || [];

        let syncedVolume = 0;
        let syncedCount = 0;

        for (const order of orders) {
            const orderId = order.pubkey || order.id || order.dcaPubKey;
            if (!orderId) continue;

            const maker = order.userKey || order.user || order.userPubkey;
            if (maker && maker !== wallet) {
                console.warn(`[DCA Sync] Wallet mismatch spoofing attempt! maker=${maker}, requested_wallet=${wallet}`);
                continue;
            }

            const filledCount = order.state?.ordersFilled || 0;
            if (filledCount === 0) continue;

            const fillId = `dca-${orderId}-fill-${filledCount}`;
            const isProcessed = await hasOrderBeenProcessed(fillId);
            if (isProcessed) continue;

            let volumeUsd = 0;
            const inputMint = order.inputMint;
            const inAmountPerOrder = order.inAmountPerOrder || order.state?.inAmountPerOrder || "0";
            
            if (inputMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" || inputMint === "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB") {
                volumeUsd = Number(inAmountPerOrder) / 1e6;
            } else {
                volumeUsd = 10; // Fallback minimum volume
            }

            if (volumeUsd > 0) {
                await addVolume(wallet, volumeUsd);
                await markOrderProcessed(fillId, wallet, volumeUsd);

                const outputMint = order.outputMint || "";
                const feeBps = getEffectiveFeeBps(0, outputMint);
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
                
                syncedVolume += volumeUsd;
                syncedCount++;
            }
        }

        return NextResponse.json({ success: true, syncedCount, syncedVolume });
    } catch (error: any) {
        console.error("[DCA Sync] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
