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

// 🐳 FAKE WHALES (Mock Data mixed with Real Data)
const FAKE_WHALES: Omit<LeaderboardEntry, 'rank'>[] = [
    { wallet: "Hyt...9s2", points: 154200, volume: 450000, tradeCount: 245, totalFeesPaid: 2250 },
    { wallet: "8fr...k21", points: 120500, volume: 320000, tradeCount: 189, totalFeesPaid: 1600 },
    { wallet: "3da...p99", points: 98000, volume: 280000, tradeCount: 156, totalFeesPaid: 1400 },
    { wallet: "G2a...x12", points: 54000, volume: 120000, tradeCount: 87, totalFeesPaid: 600 },
    { wallet: "W9s...m44", points: 32000, volume: 85000, tradeCount: 52, totalFeesPaid: 425 },
];

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        // Fetch Top 20 Real Users by volume
        const q = query(collection(db, "users"), orderBy("volume", "desc"), limit(20));
        const querySnapshot = await getDocs(q);

        const realUsers: Omit<LeaderboardEntry, 'rank'>[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            realUsers.push({
                wallet: doc.id,
                points: data.points || 0,
                volume: data.volume || 0,
                tradeCount: data.tradeCount || 0,
                totalFeesPaid: data.totalFeesPaid || 0,
            });
        });

        // MERGE: Real Users + Fake Whales
        const combinedData = [...realUsers, ...FAKE_WHALES];

        // SORT: By Volume Descending (for milestone system)
        combinedData.sort((a, b) => b.volume - a.volume);

        // RANK & LIMIT: Assign ranks and take Top 50
        const leaderboard: LeaderboardEntry[] = combinedData
            .map((entry, index) => ({
                ...entry,
                rank: index + 1
            }))
            .slice(0, 50);

        return leaderboard;
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        return FAKE_WHALES.map((w, i) => ({ ...w, rank: i + 1 }));
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

