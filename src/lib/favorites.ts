import { db } from "./firebase";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    arrayRemove
} from "firebase/firestore";

// Default tokens everyone sees
export const DEFAULT_TOKENS = [
    "So11111111111111111111111111111111111111112", // SOL
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
];

/**
 * Get user's favorite token addresses
 */
export async function getFavoriteTokens(wallet: string): Promise<string[]> {
    try {
        const userRef = doc(db, "users", wallet);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return DEFAULT_TOKENS;
        }

        const data = userDoc.data();
        const favorites = data.favoriteTokens || [];

        // Merge defaults with user favorites (no duplicates)
        const merged = [...new Set([...DEFAULT_TOKENS, ...favorites])];
        return merged;
    } catch (error) {
        console.error("Error fetching favorite tokens:", error);
        return DEFAULT_TOKENS;
    }
}

/**
 * Add a token to user's favorites
 */
export async function addFavoriteToken(wallet: string, tokenAddress: string): Promise<void> {
    try {
        const userRef = doc(db, "users", wallet);
        await setDoc(userRef, {
            favoriteTokens: arrayUnion(tokenAddress),
            wallet: wallet
        }, { merge: true });
        console.log("✅ Token added to favorites");
    } catch (error) {
        console.error("Error adding favorite token:", error);
    }
}

/**
 * Remove a token from user's favorites
 */
export async function removeFavoriteToken(wallet: string, tokenAddress: string): Promise<void> {
    try {
        // Don't allow removing default tokens
        if (DEFAULT_TOKENS.includes(tokenAddress)) {
            console.log("Cannot remove default tokens");
            return;
        }

        const userRef = doc(db, "users", wallet);
        await updateDoc(userRef, {
            favoriteTokens: arrayRemove(tokenAddress)
        });
        console.log("✅ Token removed from favorites");
    } catch (error) {
        console.error("Error removing favorite token:", error);
    }
}

/**
 * Check if a token is in user's favorites
 */
export async function isTokenFavorite(wallet: string, tokenAddress: string): Promise<boolean> {
    const favorites = await getFavoriteTokens(wallet);
    return favorites.includes(tokenAddress);
}
