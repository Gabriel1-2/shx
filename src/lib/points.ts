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
    dailyVolume?: number;
    tradeCount?: number;
    totalFeesPaid?: number;
    weeklyFeesPaid?: number;
    dailyFeesPaid?: number;
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

function getCurrentDayStart(): string {
    const now = new Date();
    return now.toISOString().split("T")[0];
}

/**
 * Get the weekly leaderboard — ranked by weekly fees generated.
 * 
 * Includes traders who generated at least MIN_WEEKLY_FEES_USD in fees.
 */
export async function getWeeklyLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const currentWeek = getCurrentWeekStart();

        // Fetch all users ordered by weeklyFeesPaid desc (simple index)
        const q = query(
            collection(db, "users"),
            orderBy("weeklyFeesPaid", "desc"),
            limit(50)
        );
        const snapshot = await getDocs(q);

        const entries: LeaderboardEntry[] = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const weeklyFees = data.weeklyFeesPaid || 0;
            
            // Only include users from the current week who generated >= $10 in fees
            if (data.weekStart === currentWeek && weeklyFees >= 10) {
                entries.push({
                    wallet: docSnap.id,
                    points: data.points || 0,
                    volume: data.volume || 0,
                    weeklyVolume: data.weeklyVolume || 0,
                    tradeCount: data.tradeCount || 0,
                    totalFeesPaid: data.totalFeesPaid || 0,
                    weeklyFeesPaid: weeklyFees,
                    rank: 0,
                });
            }
        });

        // Sort by weekly fees
        entries.sort((a, b) => (b.weeklyFeesPaid || 0) - (a.weeklyFeesPaid || 0));

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
                const weeklyFees = data.weeklyFeesPaid || 0;
                if (data.weekStart === currentWeek && weeklyFees >= 10) {
                    entries.push({
                        wallet: docSnap.id,
                        points: data.points || 0,
                        volume: data.volume || 0,
                        weeklyVolume: data.weeklyVolume || 0,
                        tradeCount: data.tradeCount || 0,
                        totalFeesPaid: data.totalFeesPaid || 0,
                        weeklyFeesPaid: weeklyFees,
                        rank: 0,
                    });
                }
            });

            entries.sort((a, b) => (b.weeklyFeesPaid || 0) - (a.weeklyFeesPaid || 0));
            return entries.slice(0, 10).map((e, i) => ({ ...e, rank: i + 1 }));
        } catch (fallbackError) {
            console.error("Fallback leaderboard also failed:", fallbackError);
            return [];
        }
    }
}

/**
 * Get the daily leaderboard — ranked by daily volume.
 */
export async function getDailyLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const currentDay = getCurrentDayStart();
        
        // Fetch users ordered by volume (all-time) as a fallback since dailyVolume index might not exist
        // or just fetch all and filter in memory.
        const q = query(collection(db, "users"));
        const querySnapshot = await getDocs(q);

        const realUsers: LeaderboardEntry[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const dailyVol = data.dayStart === currentDay ? (data.dailyVolume || 0) : 0;
            const dailyFees = data.dayStart === currentDay ? (data.dailyFeesPaid || 0) : 0;
            
            if (dailyVol > 0 || dailyFees > 0) {
                realUsers.push({
                    wallet: doc.id,
                    points: data.points || 0,
                    volume: data.volume || 0,
                    weeklyVolume: data.weeklyVolume || 0,
                    dailyVolume: dailyVol,
                    tradeCount: data.tradeCount || 0,
                    totalFeesPaid: data.totalFeesPaid || 0,
                    weeklyFeesPaid: data.weeklyFeesPaid || 0,
                    dailyFeesPaid: dailyFees,
                    rank: 0,
                });
            }
        });

        realUsers.sort((a, b) => (b.dailyVolume || 0) - (a.dailyVolume || 0));
        return realUsers.map((entry, index) => ({ ...entry, rank: index + 1 })).slice(0, 50);
    } catch (error) {
        console.error("Error fetching daily leaderboard:", error);
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
 * Maintains weekly + daily volume with automatic reset.
 * Daily snapshot archiving is handled server-side in analytics/track route.
 */
export async function addVolume(wallet: string, volumeUSD: number) {
    console.log(`[ FIRESTORE ] Adding $${volumeUSD} volume to ${wallet}`);

    try {
        const userRef = doc(db, "users", wallet);
        const currentWeek = getCurrentWeekStart();
        const currentDay = getCurrentDayStart();

        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : null;
        const existingWeekStart = data ? data.weekStart : null;
        const existingDayStart = data ? data.dayStart : null;

        const updateData: any = {
            volume: increment(volumeUSD),
            tradeCount: increment(1),
            wallet: wallet,
            lastActive: new Date().toISOString()
        };

        if (existingWeekStart !== currentWeek) {
            updateData.weeklyVolume = volumeUSD;
            updateData.weekStart = currentWeek;
        } else {
            updateData.weeklyVolume = increment(volumeUSD);
        }

        if (existingDayStart !== currentDay) {
            updateData.dailyVolume = volumeUSD;
            updateData.dailyFeesPaid = 0;
            updateData.dailyTradeCount = 1;
            updateData.dayStart = currentDay;
        } else {
            updateData.dailyVolume = increment(volumeUSD);
            updateData.dailyTradeCount = increment(1);
        }

        await setDoc(userRef, updateData, { merge: true });

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
            const currentDay = getCurrentDayStart();

            return {
                points: data.points || 0,
                rank: 0,
                volume: data.volume || 0,
                weeklyVolume: data.weekStart === currentWeek ? (data.weeklyVolume || 0) : 0,
                dailyVolume: data.dayStart === currentDay ? (data.dailyVolume || 0) : 0,
                tradeCount: data.tradeCount || 0,
                totalFeesPaid: data.totalFeesPaid || 0,
            };
        } else {
            return { points: 0, rank: 0, volume: 0, weeklyVolume: 0, dailyVolume: 0, tradeCount: 0, totalFeesPaid: 0 };
        }
    } catch (error) {
        console.error("Error fetching user stats:", error);
        return { points: 0, rank: 0, volume: 0, weeklyVolume: 0, dailyVolume: 0, tradeCount: 0, totalFeesPaid: 0 };
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
