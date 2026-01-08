import { db } from "./firebase";
import {
    doc,
    getDoc,
    setDoc,
    increment,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from "firebase/firestore";

// Generate a unique referral code from wallet address
export function generateReferralCode(wallet: string): string {
    // Take first 4 and last 4 chars of wallet, add a hash
    const prefix = wallet.slice(0, 4);
    const suffix = wallet.slice(-4);
    return `SHX-${prefix}${suffix}`.toUpperCase();
}

// Store referral relationship
export async function registerReferral(newUserWallet: string, referralCode: string) {
    try {
        // Find the referrer by their code
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("referralCode", "==", referralCode.toUpperCase()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("Referral code not found:", referralCode);
            return { success: false, reason: "Invalid referral code" };
        }

        const referrerDoc = snapshot.docs[0];
        const referrerWallet = referrerDoc.id;

        // Don't allow self-referral
        if (referrerWallet === newUserWallet) {
            return { success: false, reason: "Cannot refer yourself" };
        }

        // Store the referral relationship on the new user
        const newUserRef = doc(db, "users", newUserWallet);
        await setDoc(newUserRef, {
            referredBy: referrerWallet,
            referralCodeUsed: referralCode.toUpperCase(),
            referralDate: new Date().toISOString()
        }, { merge: true });

        // Increment referrer's referral count
        const referrerRef = doc(db, "users", referrerWallet);
        await setDoc(referrerRef, {
            referralCount: increment(1)
        }, { merge: true });

        return { success: true, referrer: referrerWallet };
    } catch (error) {
        console.error("Error registering referral:", error);
        return { success: false, reason: "Database error" };
    }
}

// Add referral earnings when a referred user trades
export async function addReferralEarnings(traderWallet: string, feeUSD: number) {
    try {
        // Check if this user was referred
        const userRef = doc(db, "users", traderWallet);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists() || !userDoc.data().referredBy) {
            return; // Not a referred user
        }

        const referrerWallet = userDoc.data().referredBy;
        const referralEarning = feeUSD * 0.10; // 10% of fees go to referrer

        // Add to referrer's earnings
        const referrerRef = doc(db, "users", referrerWallet);
        await setDoc(referrerRef, {
            referralEarnings: increment(referralEarning),
            wallet: referrerWallet,
            lastReferralEarning: new Date().toISOString()
        }, { merge: true });

        console.log(`Added $${referralEarning.toFixed(2)} referral earnings to ${referrerWallet}`);
    } catch (error) {
        console.error("Error adding referral earnings:", error);
    }
}

// Get user's referral stats
export async function getReferralStats(wallet: string) {
    try {
        const userRef = doc(db, "users", wallet);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return {
                referralCode: generateReferralCode(wallet),
                referralCount: 0,
                referralEarnings: 0
            };
        }

        const data = userDoc.data();
        return {
            referralCode: data.referralCode || generateReferralCode(wallet),
            referralCount: data.referralCount || 0,
            referralEarnings: data.referralEarnings || 0
        };
    } catch (error) {
        console.error("Error getting referral stats:", error);
        return {
            referralCode: generateReferralCode(wallet),
            referralCount: 0,
            referralEarnings: 0
        };
    }
}

// Initialize referral code for a user (call on first connect)
export async function initializeReferralCode(wallet: string) {
    try {
        const userRef = doc(db, "users", wallet);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists() || !userDoc.data().referralCode) {
            const code = generateReferralCode(wallet);
            await setDoc(userRef, {
                referralCode: code,
                wallet: wallet
            }, { merge: true });
            return code;
        }

        return userDoc.data().referralCode;
    } catch (error) {
        console.error("Error initializing referral code:", error);
        return generateReferralCode(wallet);
    }
}

// Get top referrers for leaderboard
export async function getTopReferrers(limitCount: number = 10) {
    try {
        const q = query(
            collection(db, "users"),
            orderBy("referralEarnings", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);

        return snapshot.docs
            .filter(doc => doc.data().referralEarnings > 0)
            .map((doc, index) => ({
                rank: index + 1,
                wallet: doc.id,
                referralCount: doc.data().referralCount || 0,
                referralEarnings: doc.data().referralEarnings || 0
            }));
    } catch (error) {
        console.error("Error getting top referrers:", error);
        return [];
    }
}
