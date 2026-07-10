/**
 * Client-safe referral helpers (read-only).
 * All writes go through /api/referral → Admin SDK → Firestore.
 */
import { db } from "./firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

export function generateReferralCode(wallet: string): string {
    return `SHX-${wallet.slice(0, 4)}${wallet.slice(-4)}`.toUpperCase();
}

export async function getTopReferrers(limitCount: number = 10) {
    try {
        const q = query(
            collection(db, "users"),
            orderBy("referralEarnings", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .filter((doc) => (doc.data().referralEarnings || 0) > 0)
            .map((doc, index) => ({
                rank: index + 1,
                wallet: doc.id,
                referralCount: doc.data().referralCount || 0,
                referralEarnings: doc.data().referralEarnings || 0,
            }));
    } catch (error) {
        console.error("Error getting top referrers:", error);
        return [];
    }
}
