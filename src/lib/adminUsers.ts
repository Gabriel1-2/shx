/**
 * Server-side user / volume / order helpers using Firebase Admin.
 * All writes that must work under Firestore rules (client write: deny) go here.
 */
import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function getCurrentWeekStart(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setUTCDate(diff);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString().split("T")[0];
}

function getCurrentDayStart(): string {
    return new Date().toISOString().split("T")[0];
}

export async function adminHasOrderBeenProcessed(orderId: string): Promise<boolean> {
    if (!adminDb) return true; // fail-safe: don't double-credit if DB unavailable
    try {
        const snap = await adminDb.collection("processed_orders").doc(orderId).get();
        return snap.exists;
    } catch {
        return true;
    }
}

export async function adminMarkOrderProcessed(
    orderId: string,
    wallet: string,
    volumeUsd: number
): Promise<void> {
    if (!adminDb) return;
    await adminDb.collection("processed_orders").doc(orderId).set({
        orderId,
        wallet,
        volumeUsd,
        processedAt: new Date().toISOString(),
    });
}

/**
 * Credit trading volume (and optional points) for limit/DCA fills.
 * Idempotency should be enforced by the caller via processed_orders.
 */
export async function adminAddVolume(
    wallet: string,
    volumeUSD: number,
    opts?: { awardPoints?: boolean }
): Promise<{ success: boolean }> {
    if (!adminDb || volumeUSD <= 0) return { success: false };

    const awardPoints = opts?.awardPoints !== false;
    const points = awardPoints ? Math.max(1, Math.floor(volumeUSD)) : 0;
    const currentWeek = getCurrentWeekStart();
    const currentDay = getCurrentDayStart();
    const userRef = adminDb.collection("users").doc(wallet);

    try {
        await adminDb.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            const data = userDoc.exists ? userDoc.data()! : null;

            if (!data) {
                t.set(userRef, {
                    wallet,
                    points,
                    volume: volumeUSD,
                    weeklyVolume: volumeUSD,
                    weekStart: currentWeek,
                    dailyVolume: volumeUSD,
                    dayStart: currentDay,
                    dailyTradeCount: 1,
                    tradeCount: 1,
                    totalFeesPaid: 0,
                    weeklyFeesPaid: 0,
                    lastActive: new Date().toISOString(),
                });
                return;
            }

            const update: Record<string, unknown> = {
                wallet,
                volume: FieldValue.increment(volumeUSD),
                tradeCount: FieldValue.increment(1),
                lastActive: new Date().toISOString(),
            };

            if (points > 0) {
                update.points = FieldValue.increment(points);
            }

            if (data.weekStart === currentWeek) {
                update.weeklyVolume = FieldValue.increment(volumeUSD);
            } else {
                update.weeklyVolume = volumeUSD;
                update.weekStart = currentWeek;
            }

            if (data.dayStart === currentDay) {
                update.dailyVolume = FieldValue.increment(volumeUSD);
                update.dailyTradeCount = FieldValue.increment(1);
            } else {
                update.dailyVolume = volumeUSD;
                update.dailyTradeCount = 1;
                update.dayStart = currentDay;
            }

            t.set(userRef, update, { merge: true });
        });
        return { success: true };
    } catch (e) {
        console.error("[adminAddVolume]", e);
        return { success: false };
    }
}

export async function adminRegisterReferral(
    newUserWallet: string,
    referralCode: string
): Promise<{ success: boolean; reason?: string; referrer?: string }> {
    if (!adminDb) return { success: false, reason: "Database unavailable" };

    try {
        const snap = await adminDb
            .collection("users")
            .where("referralCode", "==", referralCode.toUpperCase())
            .limit(1)
            .get();

        if (snap.empty) return { success: false, reason: "Invalid referral code" };

        const referrerWallet = snap.docs[0].id;
        if (referrerWallet === newUserWallet) {
            return { success: false, reason: "Cannot refer yourself" };
        }

        const newUserRef = adminDb.collection("users").doc(newUserWallet);
        const existing = await newUserRef.get();
        if (existing.exists && existing.data()?.referredBy) {
            return { success: false, reason: "Already referred" };
        }

        await newUserRef.set(
            {
                referredBy: referrerWallet,
                referralCodeUsed: referralCode.toUpperCase(),
                referralDate: new Date().toISOString(),
                wallet: newUserWallet,
            },
            { merge: true }
        );

        await adminDb.collection("users").doc(referrerWallet).set(
            { referralCount: FieldValue.increment(1) },
            { merge: true }
        );

        return { success: true, referrer: referrerWallet };
    } catch (e) {
        console.error("[adminRegisterReferral]", e);
        return { success: false, reason: "Database error" };
    }
}

export function generateReferralCode(wallet: string): string {
    return `SHX-${wallet.slice(0, 4)}${wallet.slice(-4)}`.toUpperCase();
}

export async function adminInitializeReferralCode(wallet: string): Promise<string> {
    const code = generateReferralCode(wallet);
    if (!adminDb) return code;

    try {
        const ref = adminDb.collection("users").doc(wallet);
        const snap = await ref.get();
        if (snap.exists && snap.data()?.referralCode) {
            return snap.data()!.referralCode as string;
        }
        await ref.set({ referralCode: code, wallet }, { merge: true });
        return code;
    } catch {
        return code;
    }
}

/**
 * Rough USD volume from raw token amount + mint (stablecoins exact, SOL via price API, else fallback).
 */
export async function estimateVolumeUsd(
    mint: string,
    rawAmount: string | number,
    decimals: number
): Promise<number> {
    const amount = Number(rawAmount) / Math.pow(10, decimals);
    if (!amount || amount <= 0) return 0;

    const STABLES = new Set([
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    ]);
    if (STABLES.has(mint)) return amount;

    try {
        const apiKey = process.env.JUPITER_API_KEY || "";
        const headers: Record<string, string> = {};
        if (apiKey) headers["x-api-key"] = apiKey;

        const res = await fetch(`https://api.jup.ag/price/v3?ids=${mint}`, {
            headers,
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const data = await res.json();
            const price = parseFloat(data?.[mint]?.usdPrice ?? data?.data?.[mint]?.price ?? "0");
            if (price > 0) return amount * price;
        }
    } catch {
        /* fall through */
    }

    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const data = await res.json();
            const price = parseFloat(data?.pairs?.[0]?.priceUsd || "0");
            if (price > 0) return amount * price;
        }
    } catch {
        /* fall through */
    }

    return 0;
}

export function decimalsForMint(mint: string): number {
    const known: Record<string, number> = {
        So11111111111111111111111111111111111111112: 9,
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6,
        Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 6,
        "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q": 9,
        DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 5,
        EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: 6,
        JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: 6,
    };
    return known[mint] ?? 9;
}
