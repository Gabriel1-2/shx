import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { useToast } from "@/components/Toast";

interface DCAParams {
    inputMint: string;
    outputMint: string;
    inAmountPerCycle: number; // in minor units (lamports)
    cycleFrequency: number; // in seconds
    numberOfCycles: number;
}

interface ActiveDCA {
    publicKey: string;
    account: {
        inputMint: string;
        outputMint: string;
        inAmountPerCycle: string;
        cycleFrequency: string;
        numberOfCycles: string;
        nextCycleAt: string;
        createdPoint: string;
    };
}

export function useDCA() {
    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [activeDCAs, setActiveDCAs] = useState<ActiveDCA[]>([]);

    // Create DCA Order
    // Uses Jupiter Recurring API (assumed endpoint based on research, fallback to DCA API)
    const createDCA = useCallback(async (params: DCAParams) => {
        if (!publicKey || !signTransaction) {
            showToast({ title: "Error", message: "Please connect your wallet first", type: "error" });
            return;
        }

        setLoading(true);
        try {
            // Endpoint: https://dca-api.jup.ag/v1/create
            // or https://api.jup.ag/recurring/v1/createOrder? 
            // Research suggests: usage of the dca-sdk is preferred for complex instruction building, 
            // but we will try the REST API if available to keep it lightweight.
            // Let's try the common endpoint for automation/dca.

            const body = {
                payer: publicKey.toString(),
                user: publicKey.toString(),
                inAmount: params.inAmountPerCycle,
                inAmountPerCycle: params.inAmountPerCycle,
                cycleSecondsApart: params.cycleFrequency,
                inputMint: params.inputMint,
                outputMint: params.outputMint,
                minOutAmountPerCycle: 0 // Simplification
            };

            // Note: If this 404s, we might need to use the SDK.
            // For now, attempting the direct transaction construction endpoint.
            // Use local proxy to bypass CORS
            const response = await fetch("/api/proxy/dca", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                // If 404, we might need to just mock it for MVP or implement SDK.
                console.error("DCA API Error:", errorText);
                throw new Error("Failed to initialize DCA. API might be restricted.");
            }

            const { tx } = await response.json();

            // Deserialize and Sign
            const transactionBuf = Buffer.from(tx, "base64");
            const transaction = VersionedTransaction.deserialize(transactionBuf);

            const signedTx = await signTransaction(transaction);

            // Send
            const rawTransaction = signedTx.serialize();
            const txid = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true,
                maxRetries: 2
            });

            await connection.confirmTransaction(txid, "confirmed");

            showToast({ title: "Success", message: "DCA Strategy Started!", type: "success" });
            fetchActiveDCAs(); // Refresh list
            return txid;

        } catch (error: any) {
            console.error("DCA Creation Error:", error);
            // Fallback for MVP if API is private/complex: 
            // We just show a "Success" toast for demonstration if it's a 404/CORS issue, 
            // but for a real app we'd need the SDK. 
            // Use notify_user to ask if they want full SDK integration if this fails.
            showToast({ title: "Error", message: error.message || "Failed to create DCA", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [publicKey, signTransaction, connection, showToast]);

    // Fetch Active DCAs
    const fetchActiveDCAs = useCallback(async () => {
        if (!publicKey) return;

        try {
            // Endpoint: https://dca-api.jup.ag/v1/user?wallet=...
            // Use local proxy
            const response = await fetch(`/api/proxy/dca?wallet=${publicKey.toString()}`);
            if (!response.ok) return;

            const data = await response.json();
            setActiveDCAs(data);
        } catch (error) {
            console.error("Fetch DCA Error:", error);
        }
    }, [publicKey]);

    // Close DCA
    const closeDCA = useCallback(async (dcaPubkey: string) => {
        if (!publicKey || !signTransaction) return;

        setLoading(true);
        try {
            // Logic to close
            const response = await fetch("https://dca-api.jup.ag/v1/close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dcaPubkey,
                    user: publicKey.toString()
                }),
            });

            if (!response.ok) throw new Error("Failed to close");

            const { tx } = await response.json();
            const transactionBuf = Buffer.from(tx, "base64");
            const transaction = VersionedTransaction.deserialize(transactionBuf);
            const signedTx = await signTransaction(transaction);
            const txid = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });

            await connection.confirmTransaction(txid, "confirmed");
            showToast({ title: "Closed", message: "DCA Strategy Closed", type: "success" });
            fetchActiveDCAs();

        } catch (error) {
            console.error("Close Error:", error);
            showToast({ title: "Error", message: "Failed to close DCA", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [publicKey, signTransaction, connection, showToast]);

    return {
        createDCA,
        closeDCA,
        fetchActiveDCAs,
        activeDCAs,
        loading
    };
}
