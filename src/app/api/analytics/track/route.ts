import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rateLimit";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const STABLECOINS = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  // USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  // USDT
    "USDH1SM1ojwWUga67PBrgQm7e7LZdPJRMghS7gsBSfB",   // USDH
];

export async function POST(req: Request) {
    const rateLimitResult = rateLimit(req, 10, 60000);
    if (!rateLimitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    if (!adminDb) {
        console.error("[Analytics] Firebase Admin not configured — adminDb is null");
        return NextResponse.json({ error: "Firebase Admin not configured" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { txid, walletAddr } = body;

        if (!txid || !walletAddr) {
            return NextResponse.json({ error: "Missing txid or walletAddr" }, { status: 400 });
        }

        console.log(`[Analytics] Processing txid=${txid.slice(0, 12)}... wallet=${walletAddr.slice(0, 8)}...`);

        // 1. Deduplicate — reject replays
        const txRef = adminDb.collection("transactions").doc(txid);
        const txDoc = await txRef.get();
        if (txDoc.exists) {
            console.log("[Analytics] Transaction already processed, skipping.");
            return NextResponse.json({ error: "Transaction already processed" }, { status: 400 });
        }

        // 2. Fetch the transaction from the RPC with retries
        const rpcUrl = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
        let tx: any = null;

        for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise(r => setTimeout(r, 2000));
            try {
                const rpcRes = await fetch(rpcUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: "shx-analytics",
                        method: "getTransaction",
                        params: [txid, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
                    }),
                });
                const rpcData = await rpcRes.json();
                if (rpcData?.result) {
                    tx = rpcData.result;
                    console.log(`[Analytics] TX found on attempt ${attempt + 1}`);
                    break;
                }
            } catch (rpcErr) {
                console.warn(`[Analytics] RPC attempt ${attempt + 1} failed:`, rpcErr);
            }
        }

        if (!tx || !tx.meta || tx.meta.err) {
            console.error("[Analytics] Transaction not found or failed on-chain");
            return NextResponse.json({ error: "Transaction not found or failed on-chain" }, { status: 404 });
        }

        // 3. Verify the wallet actually signed this transaction
        const accountKeys = tx.transaction.message.accountKeys.map((k: any) =>
            typeof k === "string" ? k : k.pubkey
        );
        const signers = tx.transaction.message.accountKeys
            .filter((k: any) => k.signer)
            .map((k: any) => k.pubkey);

        if (!signers.includes(walletAddr)) {
            console.error("[Analytics] Wallet did not sign this transaction");
            return NextResponse.json({ error: "Wallet address did not sign this transaction" }, { status: 403 });
        }

        // 4. Calculate token balance changes for this wallet
        //    Using uiTokenAmount.uiAmount (already decimal-adjusted) instead of raw amount
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];

        const changes: { mint: string; change: number }[] = [];

        for (const post of postBalances) {
            const owner = post.owner || accountKeys[post.accountIndex];
            if (owner !== walletAddr) continue;

            const pre = preBalances.find((p: any) =>
                p.mint === post.mint && (p.owner || accountKeys[p.accountIndex]) === walletAddr
            );

            // Use uiAmount which is already adjusted for decimals by the RPC
            const preUiAmount = pre?.uiTokenAmount?.uiAmount ?? 0;
            const postUiAmount = post.uiTokenAmount?.uiAmount ?? 0;
            const diff = postUiAmount - preUiAmount;

            if (Math.abs(diff) > 0.000001) {
                changes.push({ mint: post.mint, change: diff });
            }
        }

        // Also check native SOL balance change (lamports)
        const walletIdx = accountKeys.indexOf(walletAddr);
        if (walletIdx >= 0 && tx.meta.preBalances && tx.meta.postBalances) {
            const preSolLamports = tx.meta.preBalances[walletIdx] || 0;
            const postSolLamports = tx.meta.postBalances[walletIdx] || 0;
            const solDiff = (postSolLamports - preSolLamports) / 1e9;
            // Only count if > 0.002 SOL to ignore just tx fees (~0.000005 SOL)
            if (Math.abs(solDiff) > 0.002) {
                changes.push({ mint: SOL_MINT, change: solDiff });
            }
        }

        console.log("[Analytics] Token changes:", JSON.stringify(changes.map(c => ({
            mint: c.mint.slice(0, 8) + "...",
            change: c.change.toFixed(6)
        }))));

        // 5. Identify input (spent) and output (received) tokens
        const spent = changes.find(c => c.change < 0);
        const received = changes.find(c => c.change > 0);

        const inputAmount = spent ? Math.abs(spent.change) : 0;
        const outputAmount = received ? received.change : 0;
        const inputMint = spent?.mint || "";
        const outputMint = received?.mint || "";

        // 6. Calculate USD volume
        let volumeUSD = 0;

        if (inputAmount > 0 || outputAmount > 0) {
            if (STABLECOINS.includes(inputMint)) {
                // Input is a stablecoin — volume = exact USD
                volumeUSD = inputAmount;
            } else if (STABLECOINS.includes(outputMint)) {
                // Output is a stablecoin — volume = exact USD
                volumeUSD = outputAmount;
            } else {
                // Neither is a stablecoin — fetch prices
                volumeUSD = await getVolumeUSD(inputMint, inputAmount, outputMint, outputAmount);
                console.log(`[Analytics] Priced volume: $${volumeUSD.toFixed(4)}`);
            }
        }

        // 7. Calculate XP: 1 point per $1 volume, minimum 1 point per trade
        const points = Math.max(1, Math.floor(volumeUSD));

        console.log(`[Analytics] FINAL: volume=$${volumeUSD.toFixed(4)}, points=${points}, input=${inputAmount.toFixed(6)} ${inputMint.slice(0, 8)}, output=${outputAmount.toFixed(6)} ${outputMint.slice(0, 8)}`);

        // 8. Atomically update Firestore
        const userRef = adminDb.collection("users").doc(walletAddr);
        const currentWeek = getCurrentWeekStart();

        await adminDb.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);

            if (!userDoc.exists) {
                // New user — set initial values
                t.set(userRef, {
                    wallet: walletAddr,
                    points: points,
                    volume: volumeUSD,
                    weeklyVolume: volumeUSD,
                    weekStart: currentWeek,
                    tradeCount: 1,
                    totalFeesPaid: 0,
                    lastActive: new Date().toISOString(),
                });
            } else {
                // Existing user — increment values
                const data = userDoc.data()!;
                const updateData: any = {
                    wallet: walletAddr,
                    points: FieldValue.increment(points),
                    volume: FieldValue.increment(volumeUSD),
                    tradeCount: FieldValue.increment(1),
                    lastActive: new Date().toISOString(),
                };

                // Weekly volume reset
                if (data.weekStart !== currentWeek) {
                    updateData.weeklyVolume = volumeUSD;
                    updateData.weekStart = currentWeek;
                } else {
                    updateData.weeklyVolume = FieldValue.increment(volumeUSD);
                }

                t.set(userRef, updateData, { merge: true });
            }

            // Record the transaction itself (for history + dedup)
            t.set(txRef, {
                txid,
                wallet: walletAddr,
                volumeUSD,
                points,
                inputMint,
                outputMint,
                inputAmount,
                outputAmount,
                timestamp: FieldValue.serverTimestamp(),
            });
        });

        console.log(`[Analytics] ✅ Saved successfully for ${walletAddr.slice(0, 8)}...`);
        return NextResponse.json({ success: true, volumeUSD, points });

    } catch (error: any) {
        console.error("[Analytics] CRITICAL ERROR:", error?.message || error);
        return NextResponse.json({ error: "Internal Server Error", details: error?.message }, { status: 500 });
    }
}

function getCurrentWeekStart(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setUTCDate(diff);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString().split("T")[0];
}

/**
 * Get USD price for a token mint.
 * Tries Jupiter Price API first, then DexScreener as fallback.
 * Handles native SOL specially since Jupiter sometimes fails on it.
 */
async function getTokenPrice(mint: string): Promise<number> {
    const SOL_MINTS = ["So11111111111111111111111111111111111111112", "SOL"];
    
    // Special case for SOL: use CoinGecko which is highly reliable for majors
    if (SOL_MINTS.includes(mint)) {
        try {
            const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {
                signal: AbortSignal.timeout(5000)
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.solana?.usd > 0) return data.solana.usd;
            }
        } catch (e) {
            console.warn("[Analytics] CoinGecko SOL price failed:", (e as Error).message);
        }
    }

    // Try Jupiter first
    try {
        const res = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const text = await res.text();
            if (text && text.length > 2) {
                const data = JSON.parse(text);
                const price = parseFloat(data?.data?.[mint]?.price || "0");
                if (price > 0) return price;
            }
        }
    } catch (e) {
        console.warn(`[Analytics] Jupiter price failed for ${mint.slice(0, 8)}:`, (e as Error).message);
    }

    // Fallback: DexScreener
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const data = await res.json();
            const price = parseFloat(data?.pairs?.[0]?.priceUsd || "0");
            if (price > 0) return price;
        }
    } catch (e) {
        console.warn(`[Analytics] DexScreener price failed for ${mint.slice(0, 8)}:`, (e as Error).message);
    }

    return 0;
}

/**
 * Calculate USD volume from token changes.
 * Tries to price the input side first, then the output side.
 */
async function getVolumeUSD(
    inputMint: string, inputAmount: number,
    outputMint: string, outputAmount: number
): Promise<number> {
    // Try pricing both in parallel
    const [inputPrice, outputPrice] = await Promise.all([
        inputMint ? getTokenPrice(inputMint) : Promise.resolve(0),
        outputMint ? getTokenPrice(outputMint) : Promise.resolve(0),
    ]);

    console.log(`[Analytics] Prices: ${inputMint.slice(0, 8)}=$${inputPrice}, ${outputMint.slice(0, 8)}=$${outputPrice}`);

    if (inputPrice > 0 && inputAmount > 0) {
        return inputAmount * inputPrice;
    }
    if (outputPrice > 0 && outputAmount > 0) {
        return outputAmount * outputPrice;
    }

    return 0;
}
