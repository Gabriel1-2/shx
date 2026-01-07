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
    limit
} from "firebase/firestore";

export interface LeaderboardEntry {
    wallet: string;
    points: number;
    rank: number;
    volume: number;
    tradeCount?: number;
    totalFeesPaid?: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        // Fetch Top 20 Real Users by volume
        const q = query(collection(db, "users"), orderBy("volume", "desc"), limit(20));
        const querySnapshot = await getDocs(q);

        const realUsers: LeaderboardEntry[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            realUsers.push({
                wallet: doc.id,
                points: data.points || 0,
                volume: data.volume || 0,
                tradeCount: data.tradeCount || 0,
                totalFeesPaid: data.totalFeesPaid || 0,
                rank: 0 // Will assign later
            });
        });

        // SORT: By Volume Descending
        realUsers.sort((a, b) => b.volume - a.volume);

        // RANK & LIMIT
        const leaderboard: LeaderboardEntry[] = realUsers
            .map((entry, index) => ({
                ...entry,
                rank: index + 1
            }))
            .slice(0, 50);

        return leaderboard;
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
 * Add trading volume to a wallet (called on every successful swap)
 */
export async function addVolume(wallet: string, volumeUSD: number) {
    console.log(`[ FIRESTORE ] Adding $${volumeUSD} volume to ${wallet}`);

    try {
        const userRef = doc(db, "users", wallet);

        await setDoc(userRef, {
            volume: increment(volumeUSD),
            tradeCount: increment(1),
            wallet: wallet,
            lastActive: new Date().toISOString()
        }, { merge: true });

        return { success: true };
    } catch (error) {
        console.error("Error adding volume:", error);
        return { success: false };
    }
}

/**
 * Add fees paid by a wallet (for milestone eligibility)
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
            return {
                points: data.points || 0,
                rank: 0, // Calculated client-side from leaderboard
                volume: data.volume || 0,
                tradeCount: data.tradeCount || 0,
                totalFeesPaid: data.totalFeesPaid || 0
            };
        } else {
            return { points: 0, rank: 0, volume: 0, tradeCount: 0, totalFeesPaid: 0 };
        }
    } catch (error) {
        console.error("Error fetching user stats:", error);
        return { points: 0, rank: 0, volume: 0, tradeCount: 0, totalFeesPaid: 0 };
    }
}

