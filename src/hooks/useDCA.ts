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

            const body = {
                payer: publicKey.toString(),
                user: publicKey.toString(),
                inAmount: params.inAmountPerCycle,
                inAmountPerCycle: params.inAmountPerCycle,
                cycleSecondsApart: params.cycleFrequency,
                inputMint: params.inputMint,
                outputMint: params.outputMint,
                minOutAmountPerCycle: 0,
                computeUnitPrice: "auto" // Vital for landing txs
            };

            // Use local proxy to bypass CORS
            const response = await fetch("/api/proxy/dca?action=create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("DCA API Error:", errorData);
                throw new Error(errorData.error || "Failed to initialize DCA. API might be restricted.");
            }

            const { tx } = await response.json();

            // Deserialize 
            const transactionBuf = Buffer.from(tx, "base64");
            const transaction = VersionedTransaction.deserialize(transactionBuf);

            // Pre-Flight Simulation
            const sim = await connection.simulateTransaction(transaction);
            if (sim.value.err) {
                console.error("DCA Simulation Failed:", sim.value.err, sim.value.logs);
                let msg = "Simulation Failed";
                if (sim.value.logs?.some(l => l.includes("0x1"))) msg = "Insufficient funds for setup (Rent + Fees).";
                throw new Error(msg);
            }

            // Sign
            const signedTx = await signTransaction(transaction);

            // Send
            const rawTransaction = signedTx.serialize();
            const txid = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true, // We already simulated
                maxRetries: 2
            });

            await connection.confirmTransaction(txid, "confirmed");

            showToast({ title: "Success", message: "DCA Strategy Started!", type: "success" });
            fetchActiveDCAs(); // Refresh list
            return txid;

        } catch (error: any) {
            console.error("DCA Creation Error:", error);
            let msg = error.message;
            if (msg.includes("User rejected")) msg = "Cancelled by user";
            showToast({ title: "Error", message: msg, type: "error" });
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
            const response = await fetch("/api/proxy/dca?action=close", {
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
