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
 * Only includes wallets with >= $1,000 weekly volume.
 */
export async function getWeeklyLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const currentWeek = getCurrentWeekStart();

        // Query users with current week data, ordered by weeklyVolume
        const q = query(
            collection(db, "users"),
            where("weekStart", "==", currentWeek),
            orderBy("weeklyVolume", "desc"),
            limit(10)
        );
        const snapshot = await getDocs(q);

        const entries: LeaderboardEntry[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if ((data.weeklyVolume || 0) >= 1000) {
                entries.push({
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

        return entries.map((e, i) => ({ ...e, rank: i + 1 }));
    } catch (error) {
        console.error("Error fetching weekly leaderboard:", error);
        return [];
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
            realUsers.push({
                wallet: doc.id,
                points: data.points || 0,
                volume: data.volume || 0,
                weeklyVolume: data.weeklyVolume || 0,
                tradeCount: data.tradeCount || 0,
                totalFeesPaid: data.totalFeesPaid || 0,
                rank: 0,
            });
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
