import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { useToast } from "@/components/Toast";

interface LimitOrderParams {
    inputMint: string;
    outputMint: string;
    inAmount: number; // in minor units (lamports)
    outAmount: number; // in minor units
    expiredAt?: number | null; // UNIX timestamp in seconds
}

export interface OpenOrder {
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
    const { publicKey, signTransaction } = useWallet();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);

    // Fetch Open Orders
    const fetchOpenOrders = useCallback(async () => {
        if (!publicKey) return;

        try {
            // Endpoint: https://jup.ag/api/limit/v1/openOrders?wallet=...
            // Note: Trigger API might have a different one, but let's try this standard one first.
            // Endpoint: /api/proxy/limit?wallet=...
            const response = await fetch(`/api/proxy/limit?wallet=${publicKey.toString()}`);
            if (!response.ok) return;

            const data = await response.json();
            setOpenOrders(data);
        } catch (error) {
            console.error("Fetch Orders Error:", error);
        }
    }, [publicKey]);

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
            const body = {
                owner: publicKey.toString(),
                inAmount: params.inAmount,
                outAmount: params.outAmount,
                inputMint: params.inputMint,
                outputMint: params.outputMint,
                expiredAt: params.expiredAt || null,
                base: new PublicKey(params.inputMint).toBase58(),
                // Vital for Wallet Health:
                computeUnitPrice: "auto"
            };

            // 2. Fetch Transaction from Local Proxy
            const response = await fetch("/api/proxy/limit?action=create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || "Failed to create order");
            }

            const { tx } = await response.json();

            // 3. Deserialize
            const transactionBuf = Buffer.from(tx, "base64");
            const transaction = VersionedTransaction.deserialize(transactionBuf);

            // 4. Pre-Flight Simulation (Guard)
            const sim = await connection.simulateTransaction(transaction);
            if (sim.value.err) {
                console.error("Limit Order Simulation Failed:", sim.value.err, sim.value.logs);
                // Extract useful error
                let msg = "Simulation Failed";
                if (sim.value.logs?.some(l => l.includes("0x1"))) msg = "Insufficient funds for rent/fees.";
                throw new Error(msg);
            }

            // 5. Sign and Send
            const signedTx = await signTransaction(transaction);
            const rawTransaction = signedTx.serialize();

            // Skip preflight on send since we manually simulated
            const txid = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true,
                maxRetries: 2
            });

            await connection.confirmTransaction(txid, "confirmed");

            showToast({ title: "Order Placed", message: "Limit Order Placed via Jupiter!", type: "success" });
            fetchOpenOrders(); // Refresh list
            return txid;

        } catch (error: unknown) {
            console.error("Limit Order Error:", error);
            // Nice error formatting
            let msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("User rejected")) msg = "Cancelled by user";
            showToast({ title: "Error", message: msg, type: "error" });
        } finally {
            setLoading(false);
        }
    }, [publicKey, signTransaction, connection, showToast, fetchOpenOrders]);

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

            const response = await fetch("/api/proxy/limit?action=cancel", {
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

        } catch (error: unknown) {
            console.error("Cancel Error:", error);
            showToast({ title: "Error", message: "Failed to cancel order", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [publicKey, signTransaction, connection, showToast, fetchOpenOrders]);

    return {
        createLimitOrder,
        cancelLimitOrder,
        fetchOpenOrders,
        openOrders,
        loading
    };
}
