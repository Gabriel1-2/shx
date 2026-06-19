import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Records a fee event in the `fee_ledger` collection and updates the
 * user's aggregated fee counters.
 * 
 * This is the single source of truth for ALL fee events — swaps, limit
 * orders, DCA fills, and agent trades.
 */
export interface FeeEvent {
    /** Firestore-safe unique key (txid or orderId) */
    id: string;
    wallet: string;
    /** Fee in USD */
    feeUsd: number;
    /** Fee in basis points that was applied */
    feeBps: number;
    /** Trade volume that generated this fee */
    volumeUsd: number;
    /** Where the fee came from */
    source: "swap" | "limit" | "dca" | "agent";
    /** Token mints involved */
    inputMint?: string;
    outputMint?: string;
}

/**
 * Write a fee event to the `fee_ledger` collection AND update the user's
 * `totalFeesPaid` / `weeklyFeesPaid` counters atomically.
 * 
 * Idempotent: if the ledger doc already exists, it's a no-op.
 */
export async function recordFee(event: FeeEvent): Promise<boolean> {
    if (!adminDb) {
        console.warn("[FeeLedger] adminDb is null — skipping fee recording");
        return false;
    }

    if (event.feeUsd <= 0) {
        return false; // No fee to record (e.g. SHX buy = 0%)
    }

    try {
        const ledgerRef = adminDb.collection("fee_ledger").doc(event.id);
        const existing = await ledgerRef.get();

        if (existing.exists) {
            console.log(`[FeeLedger] Already recorded: ${event.id}`);
            return false; // Idempotent — already recorded
        }

        const currentWeek = getCurrentWeekStart();

        await adminDb.runTransaction(async (t) => {
            // 1. Write the ledger entry
            t.set(ledgerRef, {
                ...event,
                timestamp: FieldValue.serverTimestamp(),
            });

            const currentDay = getCurrentDayStart();

            // 2. Update user aggregate counters
            const userRef = adminDb!.collection("users").doc(event.wallet);
            const userDoc = await t.get(userRef);

            if (userDoc.exists) {
                const userData = userDoc.data()!;
                const updateData: Record<string, number | string | FieldValue> = {
                    totalFeesPaid: FieldValue.increment(event.feeUsd),
                };

                // Weekly fees
                if (userData.weekStart === currentWeek) {
                    updateData.weeklyFeesPaid = FieldValue.increment(event.feeUsd);
                } else {
                    updateData.weeklyFeesPaid = event.feeUsd;
                    updateData.weekStart = currentWeek;
                }

                // Daily fees
                if (userData.dayStart === currentDay) {
                    updateData.dailyFeesPaid = FieldValue.increment(event.feeUsd);
                } else {
                    updateData.dailyFeesPaid = event.feeUsd;
                    updateData.dayStart = currentDay;
                }

                t.set(userRef, updateData, { merge: true });
            } else {
                // New user — create with initial fee data
                t.set(userRef, {
                    wallet: event.wallet,
                    totalFeesPaid: event.feeUsd,
                    weeklyFeesPaid: event.feeUsd,
                    weekStart: currentWeek,
                    dailyFeesPaid: event.feeUsd,
                    dayStart: currentDay,
                    points: 0,
                    volume: 0,
                    weeklyVolume: 0,
                    dailyVolume: 0,
                    tradeCount: 0,
                    lastActive: new Date().toISOString(),
                });
            }
        });

        console.log(`[FeeLedger] ✅ Recorded $${event.feeUsd.toFixed(4)} fee from ${event.source} for ${event.wallet.slice(0, 8)}...`);
        return true;
    } catch (error) {
        console.error("[FeeLedger] Error recording fee:", error);
        return false;
    }
}

/**
 * Get total platform fees collected (all time).
 */
export async function getTotalPlatformFees(): Promise<number> {
    if (!adminDb) return 0;

    try {
        const usersSnapshot = await adminDb.collection("users").get();
        let total = 0;
        usersSnapshot.forEach((doc) => {
            total += doc.data().totalFeesPaid || 0;
        });
        return total;
    } catch (error) {
        console.error("[FeeLedger] Error getting total fees:", error);
        return 0;
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

function getCurrentDayStart(): string {
    const now = new Date();
    return now.toISOString().split("T")[0];
}
