import { db } from "./firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

interface PlatformStats {
    totalVolume: number;
    totalTrades: number;
    totalUsers: number;
    totalFees: number;
}

/**
 * Aggregate platform-wide statistics from all users
 * This sums up volume, trades, and fees from the users collection
 */
export async function getPlatformStats(): Promise<PlatformStats> {
    try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);

        let totalVolume = 0;
        let totalTrades = 0;
        let totalFees = 0;
        let totalUsers = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            totalVolume += data.volume || 0;
            totalTrades += data.tradeCount || 0;
            totalFees += data.totalFeesPaid || 0;
            if (data.volume > 0 || data.tradeCount > 0) {
                totalUsers++;
            }
        });

        return {
            totalVolume,
            totalTrades,
            totalUsers,
            totalFees
        };
    } catch (error) {
        console.error("Error fetching platform stats:", error);
        return {
            totalVolume: 0,
            totalTrades: 0,
            totalUsers: 0,
            totalFees: 0
        };
    }
}

/**
 * Get 24h volume (would need timestamp filtering in production)
 * For MVP, returns total volume
 */
export async function get24hVolume(): Promise<number> {
    const stats = await getPlatformStats();
    return stats.totalVolume;
}
