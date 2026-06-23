"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { RefreshCw, Clock, TrendingUp, Loader2, Info, ShieldCheck } from "lucide-react";
import { APP_TOKENS, TokenInfo } from "@/lib/constants";
import TokenSelector from "./TokenSelector";
import { useDebugLogs } from "./DebugLogs";

const INTERVALS = [
    { label: "Every Minute", value: 60 },
    { label: "Every Hour", value: 3600 },
    { label: "Every Day", value: 86400 },
    { label: "Every Week", value: 604800 },
];

export default function DCAPanel() {
    const { connected, publicKey, sendTransaction, signMessage } = useWallet();
    const { setVisible } = useWalletModal();
    const { addLog } = useDebugLogs();
    const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

    const [spendToken, setSpendToken] = useState<TokenInfo>(APP_TOKENS.find(t => t.symbol === "USDC") || APP_TOKENS[1]);
    const [receiveToken, setReceiveToken] = useState<TokenInfo>(APP_TOKENS.find(t => t.symbol === "SHX") || APP_TOKENS[0]);
    const [totalAmount, setTotalAmount] = useState("");
    const [numberOfOrders, setNumberOfOrders] = useState("7");
    const [selectedInterval, setSelectedInterval] = useState(INTERVALS[2]); // Daily
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
    const [currentStep, setCurrentStep] = useState<"create" | "sign" | "execute" | "">("");

    const perOrder = totalAmount && numberOfOrders
        ? (parseFloat(totalAmount) / parseInt(numberOfOrders)).toFixed(4)
        : "0";

    const totalDuration = numberOfOrders
        ? parseInt(numberOfOrders) * selectedInterval.value
        : 0;

    const formatDuration = (seconds: number) => {
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days`;
        return `${Math.floor(seconds / 604800)} weeks`;
    };

    const handleNumericInput = (value: string, setter: (v: string) => void) => {
        if (value === "" || /^\d*\.?\d*$/.test(value)) setter(value);
    };

    const handleSubmit = async () => {
        if (!connected || !publicKey || !sendTransaction) return;

        let connection: import("@solana/web3.js").Connection;
        try {
            const { Connection } = await import('@solana/web3.js');
            connection = new Connection(RPC_ENDPOINT, "confirmed");
        } catch (e) {
            console.error("Failed to init connection", e);
            setStatusType("error");
            setStatus("RPC connection error");
            return;
        }

        const parsedAmount = parseFloat(totalAmount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setStatusType("error");
            setStatus("Enter a valid amount");
            return;
        }

        // Jupiter requires minimum $50 per sub-order
        const perOrderAmount = parsedAmount / parseInt(numberOfOrders);
        if (perOrderAmount < 50 && (spendToken.symbol === "USDC" || spendToken.symbol === "USDT")) {
            setStatusType("error");
            setStatus(`Each sub-order must be at least $50 ${spendToken.symbol}. Current: $${perOrderAmount.toFixed(2)}. Increase total or reduce number of orders.`);
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        try {
            // ── Step 1: Create order (get unsigned tx) ────
            setCurrentStep("create");
            setStatusType("info");
            setStatus("Creating DCA order...");

            const rawAmount = Math.floor(parsedAmount * Math.pow(10, spendToken.decimals));

            const createRes = await fetch("/api/dca/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    user: publicKey.toString(),
                    inputMint: spendToken.address,
                    outputMint: receiveToken.address,
                    inAmount: rawAmount.toString(),
                    numberOfOrders: numberOfOrders,
                    interval: selectedInterval.value.toString(),
                }),
            });

            let createData = await createRes.json();
            
            // --- VAULT AUTO-REGISTRATION FOR DCA ---
            if (!createRes.ok && createData.error && createData.error.toLowerCase().includes("vault")) {
                if (!signMessage) throw new Error("Wallet does not support message signing required for vault registration.");
                
                setStatus("Vault missing. Please sign message to authorize vault...");
                setCurrentStep("create");

                // 1. Request Challenge
                const challengeRes = await fetch("/api/dca/create", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "request-challenge", wallet: publicKey.toString() })
                });
                const challengeData = await challengeRes.json();
                if (!challengeRes.ok) throw new Error(challengeData.error || "Failed challenge");

                // 2. Sign Challenge
                const encodedMessage = new TextEncoder().encode(challengeData.challenge);
                const signature = await signMessage(encodedMessage);
                const base58Sig = (await import("bs58")).default.encode(signature);

                // 3. Verify Challenge -> Get JWT
                const verifyRes = await fetch("/api/dca/create", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "verify-challenge", wallet: publicKey.toString(), signature: base58Sig })
                });
                const verifyData = await verifyRes.json();
                if (!verifyRes.ok) throw new Error(verifyData.error || "Failed verify");
                const jwt = verifyData.token;
                
                try { localStorage.setItem("shx_jupiter_jwt", jwt); } catch (e) {}

                // 4. Register Vault
                setStatus("Registering vault on-chain...");
                const regRes = await fetch("/api/dca/create", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "register-vault", jwt })
                });
                if (!regRes.ok) throw new Error("Failed to register vault");

                // 5. Retry Create DCA Order
                setStatus("Vault registered! Retrying DCA creation...");
                const retryCreateRes = await fetch("/api/dca/create", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "create",
                        user: publicKey.toString(),
                        inputMint: spendToken.address,
                        outputMint: receiveToken.address,
                        inAmount: rawAmount.toString(),
                        numberOfOrders: numberOfOrders,
                            interval: selectedInterval.value.toString(),
                    }),
                });
                createData = await retryCreateRes.json();
                if (!retryCreateRes.ok) throw new Error(createData.error || "Failed to create DCA order after vault registration");
            } else if (!createRes.ok) {
                // Non-vault error on the initial create call
                throw new Error(createData.error || "Failed to create DCA order");
            }

            // ── Step 2: Send the transaction ──────────────
            setCurrentStep("sign");
            const { VersionedTransaction } = await import('@solana/web3.js');
            const txBuffer = Buffer.from(createData.transaction, "base64");
            const tx = VersionedTransaction.deserialize(txBuffer);

            setStatus("Waiting for wallet approval...");
            
            // By using sendTransaction directly, we let the wallet handle priority fees
            // and we send it straight to the RPC, bypassing Jupiter's strict execute validation
            const txid = await sendTransaction(tx, connection);
            console.log("[DCA API] Transaction sent:", txid);

            setCurrentStep("execute");
            setStatus(`Waiting for on-chain confirmation... (may take up to 30s)`);
            
            // Poll for transaction confirmation using RPC
            try {
                let isConfirmed = false;
                for (let i = 0; i < 15; i++) {
                    await new Promise(r => setTimeout(r, 2000));
                    const status = await connection.getSignatureStatus(txid);
                    if (status && status.value && (status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized')) {
                        isConfirmed = true;
                        break;
                    }
                    if (status && status.value && status.value.err) {
                        throw new Error(`Deposit transaction failed on-chain: ${JSON.stringify(status.value.err)}`);
                    }
                }
                if (!isConfirmed) {
                    console.warn(`[DCA API] Transaction ${txid} not confirmed within polling window, but API accepted order. It may still confirm.`);
                }
            } catch (e) {
                console.warn("[DCA API] Error polling tx confirmation", e);
            }

            setCurrentStep("");
            setStatusType("success");
            setStatus(`✅ DCA strategy activated! Spending ${perOrder} ${spendToken.symbol} on ${receiveToken.symbol} ${selectedInterval.label.toLowerCase()}.`);
            addLog("success" as any, "DCA successfully placed", { txid });
        } catch (e: any) {
            setStatusType("error");
            setStatus(`Error: ${e.message}`);
            addLog("error", e.message || "Unknown error", e);
        } finally {
            setIsSubmitting(false);
            setTimeout(() => { setStatus((prev) => prev?.includes("✅") ? null : prev); }, 8000);
        }
    };

    const steps = [
        { id: "create", label: "Create" },
        { id: "sign", label: "Sign" },
        { id: "execute", label: "Execute" },
    ];

    return (
        <div className="w-full min-h-[420px] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <RefreshCw size={28} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-2 tracking-wide">DCA Auto-Buy</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
                Automated Dollar Cost Averaging strategies are currently undergoing security audits and optimization.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                Coming Soon
            </div>
        </div>
    );
}
