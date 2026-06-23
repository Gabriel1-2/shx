"use client";

import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowDownUp, Clock, Loader2, ShieldCheck } from "lucide-react";
import bs58 from "bs58";
import { APP_TOKENS, TokenInfo } from "@/lib/constants";
import TokenSelector from "./TokenSelector";
import { useDebugLogs } from "./DebugLogs";

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
    const { addLog } = useDebugLogs();

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
        
        let connection: import("@solana/web3.js").Connection;
        try {
            const { Connection } = await import('@solana/web3.js');
            connection = new Connection(RPC_ENDPOINT, "confirmed");
        } catch (e) {
            console.error("Failed to init connection", e);
            setStatusType("error");
            setStatusMessage("RPC connection error");
            return;
        }

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
            
            const signedTxBase64 = Buffer.from(signedTxObj.serialize()).toString("base64");
            const sig = signedTxObj.signatures[0];
            const sigBytes = sig instanceof Uint8Array ? sig : (sig as any).signature;
            const txid = bs58.encode(sigBytes);
            console.log("[Limit API] Signed transaction ID:", txid);

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
            setStatusMessage(`Waiting for API confirmation... (may take up to 30s)`);
            
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
                    console.warn(`[Limit API] Transaction ${txid} not confirmed within polling window, but API accepted order. It may still confirm.`);
                }
            } catch (e) {
                console.warn("[Limit API] Error polling tx confirmation", e);
            }

            setCurrentStep("");
            setStatusType("success");
            setStatusMessage("✅ Trigger Limit order placed successfully!");
            addLog("success" as any, "Limit order successfully placed and confirmed", { txid });
        } catch (_e) {
            const error = _e;
            const msg = error instanceof Error ? error.message : "Unknown error";
            console.error("[LimitOrder]", error);
            
            // LOG EXACT ERROR
            addLog("error", msg, error);
            
            setStatusType("error");
            
            // Provide a user-friendly message for the most common Jupiter error
            if (msg.includes("Failed to execute deposit")) {
                setStatusMessage("Error: Failed to execute deposit. Please ensure you have enough tokens for the order AND enough SOL (~0.003) for the network fee & account rent.");
            } else if (msg.includes("Transaction accounts modified")) {
                setStatusMessage("Error: Phantom modified the transaction (likely priority fees). Do not manually edit the gas fee in the wallet pop-up.");
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
        <div className="w-full min-h-[420px] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <ArrowDownUp size={28} className="text-amber-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-2 tracking-wide">Limit Orders</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
                Advanced trigger-based limit orders are currently undergoing security audits and optimization.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Coming Soon
            </div>
        </div>
    );
}
