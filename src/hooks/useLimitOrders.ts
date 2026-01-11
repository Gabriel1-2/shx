import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useToast } from "@/components/Toast";

interface LimitOrderParams {
    inputMint: string;
    outputMint: string;
    inAmount: number; // in minor units (lamports)
    outAmount: number; // in minor units
    expiredAt?: number | null; // UNIX timestamp in seconds
}

interface OpenOrder {
    publicKey: string;
    account: {
        inputMint: string;
        outputMint: string;
        inAmount: string;
        outAmount: string;
        expiredAt: string | null;
        base: string;
    };
}

export function useLimitOrders() {
    const { connection } = useConnection();
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);

    // Create Limit Order
    const createLimitOrder = useCallback(async (params: LimitOrderParams) => {
        if (!publicKey || !signTransaction) {
            showToast({ title: "Error", message: "Please connect your wallet first", type: "error" });
            return;
        }

        setLoading(true);
        try {
            // 1. Prepare Request Body
            // Jupiter Trigger API requires exact fields.
            // Base URL: https://api.jup.ag/trigger/v1/createOrder
            const body = {
                owner: publicKey.toString(),
                inAmount: params.inAmount,
                outAmount: params.outAmount,
                inputMint: params.inputMint,
                outputMint: params.outputMint,
                expiredAt: params.expiredAt || null,
                base: new PublicKey(params.inputMint).toBase58(), // Usually input mint is base
            };

            // 2. Fetch Transaction from Jupiter
            const response = await fetch("https://api.jup.ag/trigger/v1/createOrder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to create order");
            }

            const { tx } = await response.json();

            // 3. Deserialize and Sign
            const transactionBuf = Buffer.from(tx, "base64");
            const transaction = VersionedTransaction.deserialize(transactionBuf);

            const signedTx = await signTransaction(transaction);

            // 4. Send Transaction
            // We use raw connection to send signed tx
            const rawTransaction = signedTx.serialize();
            const txid = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true,
                maxRetries: 2
            });

            await connection.confirmTransaction(txid, "confirmed");

            showToast({ title: "Order Placed", message: "Limit Order Placed via Jupiter!", type: "success" });
            fetchOpenOrders(); // Refresh list
            return txid;

        } catch (error: any) {
            console.error("Limit Order Error:", error);
            showToast({ title: "Error", message: error.message || "Failed to place order", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [publicKey, signTransaction, connection, showToast]);

    // Cancel Limit Order
    const cancelLimitOrder = useCallback(async (orderPubkey: string) => {
        if (!publicKey || !signTransaction) return;

        setLoading(true);
        try {
            const body = {
                owner: publicKey.toString(),
                feePayer: publicKey.toString(),
                orders: [orderPubkey]
            };

            const response = await fetch("https://api.jup.ag/trigger/v1/cancelOrders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error("Failed to create cancel transaction");

            const { tx } = await response.json();
            const transactionBuf = Buffer.from(tx, "base64");
            const transaction = VersionedTransaction.deserialize(transactionBuf);

            const signedTx = await signTransaction(transaction);
            const rawTransaction = signedTx.serialize();

            const txid = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true
            });

            await connection.confirmTransaction(txid, "confirmed");

            showToast({ title: "Cancelled", message: "Order Cancelled", type: "success" });
            fetchOpenOrders(); // Refresh

        } catch (error: any) {
            console.error("Cancel Error:", error);
            showToast({ title: "Error", message: "Failed to cancel order", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [publicKey, signTransaction, connection, showToast]);

    // Fetch Open Orders
    const fetchOpenOrders = useCallback(async () => {
        if (!publicKey) return;

        try {
            // Endpoint: https://jup.ag/api/limit/v1/openOrders?wallet=...
            // Note: Trigger API might have a different one, but let's try this standard one first.
            const response = await fetch(`https://jup.ag/api/limit/v1/openOrders?wallet=${publicKey.toString()}`);
            if (!response.ok) return;

            const data = await response.json();
            setOpenOrders(data);
        } catch (error) {
            console.error("Fetch Orders Error:", error);
        }
    }, [publicKey]);

    return {
        createLimitOrder,
        cancelLimitOrder,
        fetchOpenOrders,
        openOrders,
        loading
    };
}
