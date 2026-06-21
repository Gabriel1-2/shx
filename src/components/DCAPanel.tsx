"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { RefreshCw, Clock, TrendingUp, Loader2, Info, ShieldCheck } from "lucide-react";
import { APP_TOKENS, TokenInfo } from "@/lib/constants";
import TokenSelector from "./TokenSelector";

const INTERVALS = [
    { label: "Every Minute", value: 60 },
    { label: "Every Hour", value: 3600 },
    { label: "Every Day", value: 86400 },
    { label: "Every Week", value: 604800 },
];

export default function DCAPanel() {
    const { connected, publicKey, signTransaction, signMessage } = useWallet();
    const { setVisible } = useWalletModal();

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
        if (!connected || !publicKey || !signTransaction) return;

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

            // ── Step 2: Sign the transaction ──────────────
            setCurrentStep("sign");
            const { VersionedTransaction } = await import('@solana/web3.js');
            const txBuffer = Buffer.from(createData.transaction, "base64");
            const tx = VersionedTransaction.deserialize(txBuffer);

            if (!signTransaction) throw new Error("Wallet does not support signTransaction");
            type SupportedTransaction = Parameters<typeof signTransaction>[0];
            const signedTxObj = await signTransaction(tx as SupportedTransaction);
            
            // MANUAL BUFFER RECONSTRUCTION:
            // @solana/web3.js VersionedTransaction.serialize() can sometimes alter message byte padding for ALTs.
            // Jupiter strictly verifies the exact message bytes, rejecting it if even 1 byte is different.
            // We manually splice the new signatures onto the original message bytes to guarantee a 100% match.
            const rawTxBytes = Buffer.from(craftData.tx, "base64");
            let offset = 0;
            while (true) {
                const b = rawTxBytes[offset];
                offset++;
                if ((b & 0x80) === 0) break;
            }
            const messageBytes = rawTxBytes.slice(offset + (signedTxObj.signatures.length * 64));
            
            const newTxBuffer = Buffer.concat([
                rawTxBytes.slice(0, offset), // Compact-u16 signature count
                ...signedTxObj.signatures.map((sig: Uint8Array) => Buffer.from(sig)), // New signatures
                messageBytes // Exact pristine message bytes
            ]);
            const signedTxBase64 = newTxBuffer.toString("base64");

            // ── Step 3: Execute via Jupiter ───────────────
            setCurrentStep("execute");
            setStatus("Executing DCA order on-chain...");

            const executeRes = await fetch("/api/dca/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "execute",
                    signedTransaction: signedTxBase64,
                    requestId: createData.requestId,
                }),
            });

            const executeData = await executeRes.json();
            if (!executeRes.ok) {
                throw new Error(executeData.error || "Failed to execute DCA order");
            }

            setCurrentStep("");
            setStatusType("success");
            setStatus(`✅ DCA strategy activated! Spending ${perOrder} ${spendToken.symbol} on ${receiveToken.symbol} ${selectedInterval.label.toLowerCase()}.`);
        } catch (e: any) {
            setStatusType("error");
            setStatus(`Error: ${e.message}`);
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
        <div className="w-full">
            {/* Header */}
            <div className="flex items-center justify-between rounded-t-2xl bg-black/60 px-4 py-3 border border-b-0 border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-5 h-5 bg-blue-500 blur-sm opacity-50 animate-pulse rounded-full"></div>
                        <RefreshCw className="relative text-blue-400 z-10" size={16} />
                    </div>
                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500 text-sm tracking-wide">
                        DCA — AUTO-BUY
                    </span>
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Recurring Orders
                </span>
            </div>

            {/* Body */}
            <div className="rounded-b-2xl border border-white/10 bg-[#0A0A0A] p-4 space-y-4">
                {/* Spend Token */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">You Spend</label>
                    <div className="flex gap-2 relative">
                        <div className="w-1/2">
                            <TokenSelector value={spendToken} onChange={setSpendToken} />
                        </div>
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Total amount"
                            value={totalAmount}
                            onChange={(e) => handleNumericInput(e.target.value, setTotalAmount)}
                            className="w-1/2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
                        />
                    </div>
                </div>

                {/* Receive Token */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">You Receive</label>
                    <TokenSelector value={receiveToken} onChange={setReceiveToken} />
                </div>

                {/* Frequency */}
                <div>
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5 block flex items-center gap-1.5">
                        <Clock size={11} />Frequency
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {INTERVALS.map(i => (
                            <button
                                key={i.value}
                                onClick={() => setSelectedInterval(i)}
                                className={`px-3 py-2 rounded-lg text-[11px] font-bold tracking-wide transition-all ${
                                    selectedInterval.value === i.value
                                        ? "bg-blue-500/20 border border-blue-500/50 text-blue-400"
                                        : "bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-white hover:border-white/[0.15]"
                                }`}
                            >
                                {i.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Number of Orders */}
                <div>
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5 block">Number of Orders</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="e.g. 7"
                        value={numberOfOrders}
                        onChange={(e) => handleNumericInput(e.target.value, setNumberOfOrders)}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
                    />
                </div>

                {/* Summary */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Info size={10} className="text-blue-400" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Order Summary</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Per Order</span>
                        <span className="text-white font-mono font-bold">{perOrder} {spendToken.symbol}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Orders</span>
                        <span className="text-white font-mono font-bold">{numberOfOrders || "0"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="text-white font-mono font-bold">{formatDuration(totalDuration)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t border-white/5">
                        <span className="text-muted-foreground">Strategy</span>
                        <span className="text-blue-400 font-bold text-[11px]">
                            Spend {perOrder} {spendToken.symbol} on {receiveToken.symbol} {selectedInterval.label.toLowerCase()}
                        </span>
                    </div>
                </div>

                {/* Step Progress (during submission) */}
                {isSubmitting && (
                    <div className="flex items-center justify-between px-2">
                        {steps.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full transition-all ${currentStep === s.id ? "bg-blue-400 animate-pulse" : (steps.findIndex(st => st.id === currentStep) > i ? "bg-green-500" : "bg-white/10")}`} />
                                <span className={`text-[9px] uppercase tracking-wider ${currentStep === s.id ? "text-blue-400" : "text-muted-foreground"}`}>{s.label}</span>
                                {i < steps.length - 1 && <div className="w-6 h-px bg-white/10 mx-1" />}
                            </div>
                        ))}
                    </div>
                )}

                {/* Submit */}
                {connected ? (
                    <button
                        onClick={handleSubmit}
                        disabled={!totalAmount || !numberOfOrders || isSubmitting}
                        className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <><Loader2 size={16} className="animate-spin" /> Creating DCA...</>
                        ) : (
                            <><TrendingUp size={16} /> Start DCA Strategy</>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={() => setVisible(true)}
                        className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                    >
                        Connect Wallet to Start
                    </button>
                )}

                {/* Status */}
                {status && (
                    <div className={`text-xs text-center rounded-lg px-3 py-2 ${
                        statusType === "error" ? "text-red-400 bg-red-500/10 border border-red-500/20"
                        : statusType === "success" ? "text-green-400 bg-green-500/10 border border-green-500/20"
                        : "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                    }`}>
                        {status}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-4 px-5 py-3 border-t border-white/[0.06] bg-black/40">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">On-Chain</span>
                </div>
                <div className="h-3 w-px bg-white/10" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Non-Custodial</span>
                <div className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1">
                    <ShieldCheck size={9} className="text-green-500" />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Jupiter Powered</span>
                </div>
            </div>
        </div>
    );
}
