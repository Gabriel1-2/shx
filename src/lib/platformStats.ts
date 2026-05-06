import { db } from "./firebase";
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";

interface PlatformStats {
    totalVolume: number;
    totalTrades: number;
    totalUsers: number;
    totalFees: number;
    dailyVolume: number;
    dailyTrades: number;
    dailyFees: number;
}

/**
 * Get the start of today (UTC midnight) as a Firestore Timestamp.
 */
function getTodayStart(): Date {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now;
}

/**
 * Aggregate platform-wide statistics from users + transactions collections.
 * 
 * All-time stats come from the users collection (already aggregated per user).
 * Daily stats come from the transactions collection (timestamp-filtered).
 */
export async function getPlatformStats(): Promise<PlatformStats> {
    try {
        // 1. All-time stats from users collection
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);

        let totalVolume = 0;
        let totalTrades = 0;
        let totalFees = 0;
        let totalUsers = 0;

        usersSnapshot.forEach((doc) => {
            const data = doc.data();
            totalVolume += data.volume || 0;
            totalTrades += data.tradeCount || 0;
            totalFees += data.totalFeesPaid || 0;
            if (data.volume > 0 || data.tradeCount > 0) {
                totalUsers++;
            }
        });

        // 2. Daily stats from transactions collection (last 24h)
        let dailyVolume = 0;
        let dailyTrades = 0;
        let dailyFees = 0;

        try {
            const todayStart = getTodayStart();
            const txRef = collection(db, "transactions");
            const dailyQuery = query(
                txRef,
                where("timestamp", ">=", Timestamp.fromDate(todayStart)),
                orderBy("timestamp", "desc")
            );
            const dailySnapshot = await getDocs(dailyQuery);

            dailySnapshot.forEach((doc) => {
                const data = doc.data();
                dailyVolume += data.volumeUSD || 0;
                dailyTrades += 1;
                dailyFees += data.feePaid || 0;
            });
        } catch (e) {
            // Index might not exist yet — fall back gracefully
            console.warn("Daily stats query failed (index may be needed):", e);
            
            // Fallback: fetch recent transactions without compound query
            try {
                const txRef = collection(db, "transactions");
                const recentQuery = query(txRef, orderBy("timestamp", "desc"), limit(100));
                const recentSnapshot = await getDocs(recentQuery);
                const todayStart = getTodayStart();

                recentSnapshot.forEach((doc) => {
                    const data = doc.data();
                    const txTime = data.timestamp?.toDate?.();
                    if (txTime && txTime >= todayStart) {
                        dailyVolume += data.volumeUSD || 0;
                        dailyTrades += 1;
                        dailyFees += data.feePaid || 0;
                    }
                });
            } catch (e2) {
                console.warn("Fallback daily query also failed:", e2);
            }
        }

        return {
            totalVolume,
            totalTrades,
            totalUsers,
            totalFees,
            dailyVolume,
            dailyTrades,
            dailyFees,
        };
    } catch (error) {
        console.error("Error fetching platform stats:", error);
        return {
            totalVolume: 0,
            totalTrades: 0,
            totalUsers: 0,
            totalFees: 0,
            dailyVolume: 0,
            dailyTrades: 0,
            dailyFees: 0,
        };
    }
}

/**
 * Get 24h platform volume from the transactions collection.
 */
export async function get24hVolume(): Promise<number> {
    const stats = await getPlatformStats();
    return stats.dailyVolume;
}
