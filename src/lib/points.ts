import { db } from "./firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    increment,
    query,
    orderBy,
    limit,
    where
} from "firebase/firestore";

export interface LeaderboardEntry {
    wallet: string;
    points: number;
    rank: number;
    volume: number;
    weeklyVolume: number;
    tradeCount?: number;
    totalFeesPaid?: number;
}

/**
 * Get the ISO Monday date string for the current week.
 * Used to track weekly volume resets.
 */
function getCurrentWeekStart(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now);
    monday.setUTCDate(diff);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString().split("T")[0]; // "2026-03-24"
}

/**
 * Get the weekly leaderboard — ranked by weekly USD volume.
 * 
 * ROBUST VERSION: Fetches all users ordered by volume, then filters 
 * client-side for the current week. This avoids the need for a composite
 * Firestore index on (weekStart, weeklyVolume).
 * 
 * No minimum volume requirement for display — we show everyone who traded.
 */
export async function getWeeklyLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const currentWeek = getCurrentWeekStart();

        // Fetch all users ordered by volume desc (simple index)
        const q = query(
            collection(db, "users"),
            orderBy("weeklyVolume", "desc"),
            limit(50)
        );
        const snapshot = await getDocs(q);

        const entries: LeaderboardEntry[] = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const weeklyVol = data.weeklyVolume || 0;
            
            // Only include users from the current week who actually traded
            if (data.weekStart === currentWeek && weeklyVol > 0) {
                entries.push({
                    wallet: docSnap.id,
                    points: data.points || 0,
                    volume: data.volume || 0,
                    weeklyVolume: weeklyVol,
                    tradeCount: data.tradeCount || 0,
                    totalFeesPaid: data.totalFeesPaid || 0,
                    rank: 0,
                });
            }
        });

        // Sort by weekly volume (should already be sorted, but ensure it)
        entries.sort((a, b) => b.weeklyVolume - a.weeklyVolume);

        // Assign ranks and limit to top 10
        return entries.slice(0, 10).map((e, i) => ({ ...e, rank: i + 1 }));
    } catch (error) {
        console.error("Error fetching weekly leaderboard:", error);
        
        // Fallback: try fetching all users without ordering
        try {
            const currentWeek = getCurrentWeekStart();
            const allUsersSnapshot = await getDocs(collection(db, "users"));
            const entries: LeaderboardEntry[] = [];

            allUsersSnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const weeklyVol = data.weeklyVolume || 0;
                if (data.weekStart === currentWeek && weeklyVol > 0) {
                    entries.push({
                        wallet: docSnap.id,
                        points: data.points || 0,
                        volume: data.volume || 0,
                        weeklyVolume: weeklyVol,
                        tradeCount: data.tradeCount || 0,
                        totalFeesPaid: data.totalFeesPaid || 0,
                        rank: 0,
                    });
                }
            });

            entries.sort((a, b) => b.weeklyVolume - a.weeklyVolume);
            return entries.slice(0, 10).map((e, i) => ({ ...e, rank: i + 1 }));
        } catch (fallbackError) {
            console.error("Fallback leaderboard also failed:", fallbackError);
            return [];
        }
    }
}

/**
 * Get the all-time leaderboard (fallback / dashboard use).
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const q = query(collection(db, "users"), orderBy("volume", "desc"), limit(20));
        const querySnapshot = await getDocs(q);

        const realUsers: LeaderboardEntry[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if ((data.volume || 0) > 0) {
                realUsers.push({
                    wallet: doc.id,
                    points: data.points || 0,
                    volume: data.volume || 0,
                    weeklyVolume: data.weeklyVolume || 0,
                    tradeCount: data.tradeCount || 0,
                    totalFeesPaid: data.totalFeesPaid || 0,
                    rank: 0,
                });
            }
        });

        realUsers.sort((a, b) => b.volume - a.volume);
        return realUsers.map((entry, index) => ({ ...entry, rank: index + 1 })).slice(0, 50);
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        return [];
    }
}

export async function addPoints(wallet: string, amount: number) {
    console.log(`[ FIRESTORE ] Adding ${amount} points to ${wallet}`);

    try {
        const userRef = doc(db, "users", wallet);

        await setDoc(userRef, {
            points: increment(amount),
            wallet: wallet,
            lastActive: new Date().toISOString()
        }, { merge: true });

        const snap = await getDoc(userRef);
        return { success: true, newTotal: snap.exists() ? snap.data().points : 0 };
    } catch (error) {
        console.error("Error adding points:", error);
        return { success: false, newTotal: 0 };
    }
}

/**
 * Add trading volume to a wallet (called on every successful swap).
 * Also maintains weekly volume with automatic reset.
 */
export async function addVolume(wallet: string, volumeUSD: number) {
    console.log(`[ FIRESTORE ] Adding $${volumeUSD} volume to ${wallet}`);

    try {
        const userRef = doc(db, "users", wallet);
        const currentWeek = getCurrentWeekStart();

        // Check if we need to reset weekly volume
        const snap = await getDoc(userRef);
        const existingWeekStart = snap.exists() ? snap.data().weekStart : null;

        if (existingWeekStart !== currentWeek) {
            // New week — reset weekly volume
            await setDoc(userRef, {
                volume: increment(volumeUSD),
                weeklyVolume: volumeUSD, // Reset to this trade's volume
                weekStart: currentWeek,
                tradeCount: increment(1),
                wallet: wallet,
                lastActive: new Date().toISOString()
            }, { merge: true });
        } else {
            // Same week — increment
            await setDoc(userRef, {
                volume: increment(volumeUSD),
                weeklyVolume: increment(volumeUSD),
                weekStart: currentWeek,
                tradeCount: increment(1),
                wallet: wallet,
                lastActive: new Date().toISOString()
            }, { merge: true });
        }

        return { success: true };
    } catch (error) {
        console.error("Error adding volume:", error);
        return { success: false };
    }
}

/**
 * Add fees paid by a wallet
 */
export async function addFeesPaid(wallet: string, feesUSD: number) {
    console.log(`[ FIRESTORE ] Adding $${feesUSD} fees paid by ${wallet}`);

    try {
        const userRef = doc(db, "users", wallet);

        await setDoc(userRef, {
            totalFeesPaid: increment(feesUSD),
            wallet: wallet,
            lastActive: new Date().toISOString()
        }, { merge: true });

        return { success: true };
    } catch (error) {
        console.error("Error adding fees:", error);
        return { success: false };
    }
}

export async function getUserStats(wallet: string) {
    try {
        const userRef = doc(db, "users", wallet);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const currentWeek = getCurrentWeekStart();

            return {
                points: data.points || 0,
                rank: 0,
                volume: data.volume || 0,
                weeklyVolume: data.weekStart === currentWeek ? (data.weeklyVolume || 0) : 0,
                tradeCount: data.tradeCount || 0,
                totalFeesPaid: data.totalFeesPaid || 0,
            };
        } else {
            return { points: 0, rank: 0, volume: 0, weeklyVolume: 0, tradeCount: 0, totalFeesPaid: 0 };
        }
    } catch (error) {
        console.error("Error fetching user stats:", error);
        return { points: 0, rank: 0, volume: 0, weeklyVolume: 0, tradeCount: 0, totalFeesPaid: 0 };
    }
}

/**
 * Checks if an async order (Limit/DCA) has already been processed for volume tracking.
 */
export async function hasOrderBeenProcessed(orderId: string): Promise<boolean> {
    try {
        const orderRef = doc(db, "processed_orders", orderId);
        const snap = await getDoc(orderRef);
        return snap.exists();
    } catch (error) {
        console.error("Error checking order status:", error);
        return true; // Fail safe to true to prevent double crediting if DB fails
    }
}

/**
 * Marks an async order as processed to prevent future double crediting.
 */
export async function markOrderProcessed(orderId: string, wallet: string, volumeUsd: number) {
    try {
        const orderRef = doc(db, "processed_orders", orderId);
        await setDoc(orderRef, {
            orderId,
            wallet,
            volumeUsd,
            processedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error marking order processed:", error);
    }
}
