import { db } from "./firebase";
import {
    collection,
    doc,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp
} from "firebase/firestore";

export interface SwapTransaction {
    id?: string;
    wallet: string;
    inputToken: string;
    inputAmount: number;
    inputMint: string;
    outputToken: string;
    outputAmount: number;
    outputMint: string;
    volumeUSD: number;
    feePaid: number;
    txSignature: string;
    timestamp: Date;
}

/**
 * Save a swap transaction to Firestore
 */
export async function saveSwapTransaction(tx: Omit<SwapTransaction, "id" | "timestamp">) {
    try {
        const txRef = collection(db, "transactions");
        await addDoc(txRef, {
            ...tx,
            timestamp: serverTimestamp()
        });
        console.log("✅ Transaction saved to database");
    } catch (error) {
        console.error("Error saving transaction:", error);
    }
}

/**
 * Get recent transactions for a wallet
 */
export async function getWalletTransactions(wallet: string, limitCount: number = 10): Promise<SwapTransaction[]> {
    try {
        const txRef = collection(db, "transactions");
        const q = query(
            txRef,
            where("wallet", "==", wallet),
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                wallet: data.wallet,
                inputToken: data.inputToken,
                inputAmount: data.inputAmount,
                inputMint: data.inputMint,
                outputToken: data.outputToken,
                outputAmount: data.outputAmount,
                outputMint: data.outputMint,
                volumeUSD: data.volumeUSD,
                feePaid: data.feePaid,
                txSignature: data.txSignature,
                timestamp: data.timestamp?.toDate() || new Date()
            };
        });
    } catch (error) {
        console.error("Error fetching transactions:", error);
        return [];
    }
}

/**
 * Get recent platform-wide transactions (for activity feed)
 */
export async function getRecentTransactions(limitCount: number = 20): Promise<SwapTransaction[]> {
    try {
        const txRef = collection(db, "transactions");
        const q = query(
            txRef,
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                wallet: data.wallet,
                inputToken: data.inputToken,
                inputAmount: data.inputAmount,
                inputMint: data.inputMint,
                outputToken: data.outputToken,
                outputAmount: data.outputAmount,
                outputMint: data.outputMint,
                volumeUSD: data.volumeUSD,
                feePaid: data.feePaid,
                txSignature: data.txSignature,
                timestamp: data.timestamp?.toDate() || new Date()
            };
        });
    } catch (error) {
        console.error("Error fetching recent transactions:", error);
        return [];
    }
}
