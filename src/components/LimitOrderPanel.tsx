"use client";

import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowDownUp, Clock, Loader2, ShieldCheck } from "lucide-react";
import bs58 from "bs58";
import { APP_TOKENS, TokenInfo } from "@/lib/constants";
import TokenSelector from "./TokenSelector";

type OrderSide = "buy" | "sell";

interface ExpiryOption {
    label: string;
    value: string;
    seconds: number | null;
}

const EXPIRY_OPTIONS: ExpiryOption[] = [
    { label: "24 hours", value: "24h", seconds: 86_400 },
    { label: "7 days", value: "7d", seconds: 604_800 },
    { label: "30 days", value: "30d", seconds: 2_592_000 },
    { label: "Never", value: "never", seconds: null },
];

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export default function LimitOrderPanel() {
    const { publicKey, connected, sendTransaction, signMessage, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();

    // ─── Form state ──────────────────────────────────────
    const [side, setSide] = useState<OrderSide>("buy");
    const [baseToken, setBaseToken] = useState<TokenInfo>(APP_TOKENS.find(t => t.symbol === "SHX") || APP_TOKENS[0]);
    const [quoteToken, setQuoteToken] = useState<TokenInfo>(APP_TOKENS.find(t => t.symbol === "USDC") || APP_TOKENS[1]);
    const [price, setPrice] = useState("");
    const [amount, setAmount] = useState("");
    const [expiry, setExpiry] = useState("7d");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
    const [currentStep, setCurrentStep] = useState<string>("");

    // ─── Computed ─────────────────────────────────────────
    const isBuy = side === "buy";
    const total = useMemo(() => {
        const p = parseFloat(price);
        const a = parseFloat(amount);
        return (!isNaN(p) && !isNaN(a) && p > 0 && a > 0) ? p * a : 0;
    }, [price, amount]);

    // ─── Helpers ──────────────────────────────────────────
    const handleSwapTokens = useCallback(() => {
        setBaseToken((prev) => { setQuoteToken(prev); return quoteToken; });
    }, [quoteToken]);

    const handleNumericInput = (value: string, setter: (v: string) => void) => {
        if (value === "" || /^\d*\.?\d*$/.test(value)) setter(value);
    };

    // ─── SUBMIT: Jupiter Trigger V2 Flow ────────────
    const handlePlaceOrder = useCallback(async () => {
        if (!connected || !publicKey || !sendTransaction) return;

        const p = parseFloat(price);
        const a = parseFloat(amount);

        if (isNaN(p) || p <= 0) { setStatusType("error"); setStatusMessage("Enter a valid trigger price"); return; }
        if (isNaN(a) || a <= 0) { setStatusType("error"); setStatusMessage("Enter a valid amount"); return; }

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            setCurrentStep("craft");
            setStatusType("info");
            setStatusMessage("Crafting limit order transaction...");

            const spendToken = isBuy ? quoteToken : baseToken;
            const receiveToken = isBuy ? baseToken : quoteToken;
            
            const spendAmount = isBuy ? total : a;
            const rawInAmount = Math.floor(spendAmount * Math.pow(10, spendToken.decimals));

            // --- VAULT REGISTRATION ---
            if (!signMessage) throw new Error("Wallet does not support message signing required for limit orders.");
            
            setStatusMessage("Checking Vault authentication...");
            
            // 1. Request Challenge
            const challengeRes = await fetch("/api/limit/create", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "request-challenge", wallet: publicKey.toString() })
            });
            const challengeData = await challengeRes.json();
            if (!challengeRes.ok) throw new Error(challengeData.error || "Failed challenge");

            // 2. Sign Challenge
            setStatusMessage("Please sign the authentication message in your wallet...");
            const encodedMessage = new TextEncoder().encode(challengeData.challenge);
            const signature = await signMessage(encodedMessage);
            const base58Sig = bs58.encode(signature);

            // 3. Verify Challenge -> Get JWT
            setStatusMessage("Verifying signature...");
            const verifyRes = await fetch("/api/limit/create", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "verify-challenge", wallet: publicKey.toString(), signature: base58Sig })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Failed verify");
            const jwt = verifyData.token;
            
            // Store for background sync
            try { localStorage.setItem("shx_jupiter_jwt", jwt); } catch (_e) {}

            // 3.5 Sync Past Orders (Background, do not await so it doesn't slow down the flow)
            fetch("/api/limit/sync", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: publicKey.toString(), jwt })
            }).then(r => r.json()).then(data => {
                if (data.syncedVolume > 0) {
                    console.log(`[Limit Sync] Credited $${data.syncedVolume} from ${data.syncedCount} past orders!`);
                }
            }).catch(e => console.error("[Limit Sync] Background sync failed", e));

            // 4. Register Vault (Safe to call even if exists)
            setStatusMessage("Ensuring Vault is registered on-chain...");
            const regRes = await fetch("/api/limit/create", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "register-vault", jwt })
            });
            if (!regRes.ok) throw new Error("Failed to register vault");

            // --- DEPOSIT CRAFT ---
            setStatusMessage("Crafting Deposit Transaction...");
            const craftRes = await fetch("/api/limit/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "deposit-craft",
                    wallet: publicKey.toString(),
                    jwt,
                    inputMint: spendToken.address,
                    outputMint: receiveToken.address,
                    inAmount: rawInAmount.toString(),
                }),
            });

            const craftData = await craftRes.json();
            if (!craftRes.ok) throw new Error(craftData.error || "Failed to craft order deposit");

            // --- SIGN DEPOSIT ---
            setCurrentStep("sign");
            setStatusMessage("Please sign the deposit transaction in your wallet...");
            
            const { VersionedTransaction } = await import('@solana/web3.js');
            const txBuffer = Buffer.from(craftData.transaction, "base64");
            const tx = VersionedTransaction.deserialize(txBuffer);

            // Using signTransaction to just sign without sending!
            if (!signTransaction) throw new Error("Wallet does not support signTransaction");
            type SupportedTransaction = Parameters<typeof signTransaction>[0];
            const signedTxObj = await signTransaction(tx as SupportedTransaction);
            
            // GRAFTING: Preserve original message bytes
            const pristineTx = VersionedTransaction.deserialize(txBuffer);
            pristineTx.signatures = signedTxObj.signatures as any;
            const signedTxBase64 = Buffer.from(pristineTx.serialize()).toString("base64");

            // --- SUBMIT FINAL ORDER ---
            setCurrentStep("send");
            setStatusMessage("Submitting Trigger parameters...");

            // Look up the user's expiry selection
            const selectedExpiry = EXPIRY_OPTIONS.find(o => o.value === expiry);
            const expirySeconds = selectedExpiry ? selectedExpiry.seconds : null;

            // Retry logic for Jupiter 504 timeouts
            let submitData;
            let submitOk = false;
            for (let attempt = 1; attempt <= 2; attempt++) {
                const submitRes = await fetch("/api/limit/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "submit-order",
                        wallet: publicKey.toString(),
                        jwt,
                        depositRequestId: craftData.requestId,
                        signedTransaction: signedTxBase64,
                        inputMint: spendToken.address,
                        outputMint: receiveToken.address,
                        inAmount: rawInAmount.toString(),
                        triggerPriceUsd: p,
                        side: side,
                        expirySeconds,
                    }),
                });

                let textData;
                try {
                    textData = await submitRes.text();
                    submitData = JSON.parse(textData);
                } catch(e) {
                    submitData = { error: textData ? textData.slice(0, 100) : "Invalid non-JSON response from server" };
                }

                if (submitRes.ok) {
                    submitOk = true;
                    break;
                }
                // If 504 timeout on first attempt, retry once
                if (submitRes.status === 504 && attempt < 2) {
                    setStatusMessage("Jupiter timed out, retrying...");
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                throw new Error(submitData.error || "Failed to submit limit order parameters");
            }
            if (!submitOk) throw new Error(submitData?.error || "Failed to submit limit order after retries");

            setCurrentStep("confirm");
            setStatusMessage(`Waiting for API confirmation...`);
            await new Promise(r => setTimeout(r, 1000)); // Simulate wait for API

            setCurrentStep("");
            setStatusType("success");
            setStatusMessage("✅ Trigger Limit order placed successfully!");
        } catch (_e) {
            const error = _e;
            const msg = error instanceof Error ? error.message : "Unknown error";
            console.error("[LimitOrder]", error);
            setStatusType("error");
            
            // Provide a user-friendly message for the most common Jupiter error
            if (msg.includes("Failed to execute deposit")) {
                setStatusMessage("Error: Failed to execute deposit. Please ensure you have enough tokens for the order AND enough SOL (~0.003) for the network fee & account rent.");
            } else {
                setStatusMessage(`Error: ${msg}`);
            }
        } finally {
            setIsSubmitting(false);
            setTimeout(() => { setStatusMessage((prev) => prev?.includes("✅") ? null : prev); }, 8000);
        }
    }, [connected, publicKey, price, amount, side, baseToken, quoteToken, total, sendTransaction, signMessage, signTransaction, isBuy, expiry]);

    // ─── Step indicator ──────────────────────────────────
    const steps = [
        { id: "craft", label: "Crafting" },
        { id: "sign", label: "Sign" },
        { id: "send", label: "Send" },
        { id: "confirm", label: "Confirm" },
    ];

    return (
        <div className="w-full rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl shadow-black/50 overflow-hidden">
            {/* ── Header ───────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center">
                        <div className={`absolute w-5 h-5 blur-sm opacity-50 animate-pulse rounded-full ${isBuy ? "bg-green-500" : "bg-red-500"}`} />
                        <ArrowDownUp className={`relative z-10 ${isBuy ? "text-green-400" : "text-red-400"}`} size={16} />
                    </div>
                    <span className={`font-bold text-sm tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${isBuy ? "from-green-400 to-emerald-500" : "from-red-400 to-rose-500"}`}>
                        LIMIT ORDER
                    </span>
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Jupiter Trigger v2
                </span>
            </div>

            {/* ── Body ─────────────────────────────────────── */}
            <div className="p-4 md:p-5 space-y-4">
                {/* ── Buy / Sell Toggle ────────────────────── */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <button
                        onClick={() => setSide("buy")}
                        className={`relative py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 ${isBuy ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 shadow-[inset_0_1px_0_rgba(34,197,94,0.2)]" : "text-muted-foreground hover:text-white/70"}`}
                    >
                        {isBuy && <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-green-500 to-transparent" />}
                        Buy
                    </button>
                    <button
                        onClick={() => setSide("sell")}
                        className={`relative py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 ${!isBuy ? "bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 shadow-[inset_0_1px_0_rgba(239,68,68,0.2)]" : "text-muted-foreground hover:text-white/70"}`}
                    >
                        {!isBuy && <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />}
                        Sell
                    </button>
                </div>

                {/* ── Token Pair ───────────────────────────── */}
                <div className="space-y-1.5 relative">
                    <div className="flex flex-col gap-2 relative">
                        <TokenSelector label="Base Token" value={baseToken} onChange={setBaseToken} />
                        
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                            <button onClick={handleSwapTokens} className="p-2 rounded-lg bg-[#111] border border-white/[0.12] hover:bg-white/[0.08] hover:border-white/[0.2] transition-all group shadow-xl" title="Swap pair">
                                <ArrowDownUp size={14} className="text-white transition-colors" />
                            </button>
                        </div>
                        
                        <TokenSelector label="Quote Token" value={quoteToken} onChange={setQuoteToken} />
                    </div>
                </div>

                {/* ── Trigger Price ────────────────────────── */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Trigger Price (USD)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">$</span>
                        <input type="text" inputMode="decimal" value={price} onChange={(e) => handleNumericInput(e.target.value, setPrice)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-7 pr-3 py-2.5 text-sm font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all" placeholder="0.00" />
                    </div>
                </div>

                {/* ── Amount ───────────────────────────────── */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Amount</label>
                    <div className="relative">
                        <input type="text" inputMode="decimal" value={amount} onChange={(e) => handleNumericInput(e.target.value, setAmount)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all pr-16" placeholder="0.00" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-mono font-medium">{baseToken.symbol}</span>
                    </div>
                </div>

                {/* ── Total Display ────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total</span>
                    <span className={`text-base font-mono font-bold ${total > 0 ? (isBuy ? "text-green-400" : "text-red-400") : "text-white/30"}`}>
                        ${total > 0 ? total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "0.00"}
                    </span>
                </div>

                {/* ── Expiry ───────────────────────────────── */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        <Clock size={11} />Expiry
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        {EXPIRY_OPTIONS.map((opt) => (
                            <button key={opt.value} onClick={() => setExpiry(opt.value)}
                                className={`py-2 rounded-lg text-[11px] font-bold tracking-wide transition-all duration-200 ${expiry === opt.value ? "bg-white/[0.08] text-white border border-white/[0.12] shadow-sm" : "text-muted-foreground hover:text-white/60 border border-transparent"}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Step Progress (during submission) ───── */}
                {isSubmitting && (
                    <div className="flex items-center justify-between px-2">
                        {steps.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full transition-all ${currentStep === s.id ? "bg-amber-400 animate-pulse" : (steps.findIndex(st => st.id === currentStep) > i ? "bg-green-500" : "bg-white/10")}`} />
                                <span className={`text-[9px] uppercase tracking-wider ${currentStep === s.id ? "text-amber-400" : "text-muted-foreground"}`}>{s.label}</span>
                                {i < steps.length - 1 && <div className="w-6 h-px bg-white/10 mx-1" />}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Status Message ───────────────────────── */}
                {statusMessage && (
                    <div className={`px-4 py-3 rounded-xl border text-[12px] font-medium transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${statusType === "error" ? "bg-red-500/10 border-red-500/20 text-red-400" : statusType === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"}`}>
                        {statusMessage}
                    </div>
                )}

                {/* ── Submit Button ─────────────────────────── */}
                {connected ? (
                    <button onClick={handlePlaceOrder} disabled={isSubmitting}
                        className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${isBuy ? "bg-gradient-to-r from-green-500 to-emerald-500 text-black hover:from-green-400 hover:to-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_30px_rgba(34,197,94,0.35)]" : "bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-400 hover:to-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:shadow-[0_0_30px_rgba(239,68,68,0.35)]"}`}>
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Placing Order...</span>
                        ) : (
                            `Place Limit ${isBuy ? "Buy" : "Sell"} Order`
                        )}
                    </button>
                ) : (
                    <button onClick={() => setVisible(true)}
                        className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-primary to-lime-400 text-black hover:opacity-90 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                        Connect Wallet
                    </button>
                )}
            </div>

            {/* ── Footer Trust Info ─────────────────────────── */}
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
