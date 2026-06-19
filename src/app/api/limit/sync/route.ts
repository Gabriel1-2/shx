import { NextResponse } from "next/server";
import { addVolume, hasOrderBeenProcessed, markOrderProcessed } from "@/lib/points";
import { recordFee } from "@/lib/feeLedger";
import { getEffectiveFeeBps } from "@/lib/feeTiers";

const apiKey = process.env.JUPITER_API_KEY || "";

/**
 * Sync past limit orders from Jupiter to track volume asynchronously.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { wallet, jwt } = body;

        if (!wallet || !jwt) {
            return NextResponse.json({ error: "Wallet and JWT required" }, { status: 400 });
        }

        // Fetch past orders from Jupiter
        const res = await fetch(`https://api.jup.ag/trigger/v2/orders/history?state=past&limit=20`, {
            method: "GET",
            headers: {
                "x-api-key": apiKey,
                "Authorization": `Bearer ${jwt}`
            }
        });

        if (!res.ok) {
            console.error("[Limit Sync] Jupiter API Error:", await res.text());
            return NextResponse.json({ error: "Failed to fetch order history from Jupiter" }, { status: 502 });
        }

        const data = await res.json();
        const orders = data.orders || data.data || [];

        let syncedVolume = 0;
        let syncedCount = 0;

        for (const order of orders) {
            // We only care about successfully executed/filled orders
            if (order.status !== "filled" && order.status !== "executed" && order.status !== "succeeded") {
                continue;
            }

            const orderId = order.id || order.pubkey || order.orderPubkey;
            if (!orderId) continue;

            const isProcessed = await hasOrderBeenProcessed(orderId);
            if (isProcessed) continue;

            // Calculate Volume USD
            // Note: Trigger V2 orders usually have inAmount and outAmount. 
            // We need a USD estimate. For MVP, if triggerPrice is available, use it, or fallback.
            // A more robust way is querying Jupiter price API, but for speed we'll estimate based on inAmount if it's USDC, etc.
            
            let volumeUsd = 0;
            
            // Try to extract volume. Jupiter might provide `inAmount` and `inputMint`.
            const inputMint = order.inputMint || order.makerMint;
            const inAmount = order.inAmount || order.makerAmount || "0";
            
            // Temporary simple volume estimation:
            // Since we know USDC is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
            // This can be expanded to dynamically price assets via Jupiter Price API.
            if (inputMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" || inputMint === "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB") {
                volumeUsd = Number(inAmount) / 1e6;
            } else if (order.usdValue) {
                volumeUsd = Number(order.usdValue);
            } else if (order.triggerPrice) {
                 // rough estimate if we know the token is SOL
                 if (inputMint === "So11111111111111111111111111111111111111112") {
                     volumeUsd = (Number(inAmount) / 1e9) * Number(order.triggerPrice);
                 } else {
                     volumeUsd = 10; // Fallback minimum volume
                 }
            } else {
                volumeUsd = 10; // Fallback
            }

            if (volumeUsd > 0) {
                // Award points/volume
                await addVolume(wallet, volumeUsd);
                await markOrderProcessed(orderId, wallet, volumeUsd);

                // Calculate and record fee
                const outputMint = order.outputMint || order.takerMint || "";
                const feeBps = getEffectiveFeeBps(0, outputMint); // Default tier for limit orders
                const feeUsd = (volumeUsd * feeBps) / 10000;

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
                
                syncedVolume += volumeUsd;
                syncedCount++;
            }
        }

        return NextResponse.json({ success: true, syncedCount, syncedVolume });
    } catch (error: any) {
        console.error("[Limit Sync] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
