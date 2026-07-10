"use client";

import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowDownUp, Clock, Loader2, ShieldCheck, Info } from "lucide-react";
import bs58 from "bs58";
import { APP_TOKENS, TokenInfo } from "@/lib/constants";
import TokenSelector from "./TokenSelector";
import { useDebugLogs } from "./DebugLogs";
import { useJupiterVaultAuth } from "@/hooks/useJupiterVaultAuth";

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
    { label: "90 days", value: "90d", seconds: 7_776_000 },
];

const RPC_ENDPOINT =
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com";

export default function LimitOrderPanel() {
    const { publicKey, connected, signTransaction } = useWallet();
    const { setVisible } = useWalletModal();
    const { addLog } = useDebugLogs();
    const { ensureAuth, isAuthenticating } = useJupiterVaultAuth();

    const [side, setSide] = useState<OrderSide>("buy");
    const [baseToken, setBaseToken] = useState<TokenInfo>(
        APP_TOKENS.find((t) => t.symbol === "SHX") || APP_TOKENS[0]
    );
    const [quoteToken, setQuoteToken] = useState<TokenInfo>(
        APP_TOKENS.find((t) => t.symbol === "USDC") || APP_TOKENS[1]
    );
    const [price, setPrice] = useState("");
    const [amount, setAmount] = useState("");
    const [expiry, setExpiry] = useState("7d");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
    const [currentStep, setCurrentStep] = useState<string>("");

    const isBuy = side === "buy";
    const total = useMemo(() => {
        const p = parseFloat(price);
        const a = parseFloat(amount);
        return !isNaN(p) && !isNaN(a) && p > 0 && a > 0 ? p * a : 0;
    }, [price, amount]);

    const handleSwapTokens = useCallback(() => {
        setBaseToken((prev) => {
            setQuoteToken(prev);
            return quoteToken;
        });
    }, [quoteToken]);

    const handleNumericInput = (value: string, setter: (v: string) => void) => {
        if (value === "" || /^\d*\.?\d*$/.test(value)) setter(value);
    };

    const handlePlaceOrder = useCallback(async () => {
        if (!connected || !publicKey) {
            setVisible(true);
            return;
        }
        if (!signTransaction) {
            setStatusType("error");
            setStatusMessage("Wallet does not support transaction signing");
            return;
        }

        const p = parseFloat(price);
        const a = parseFloat(amount);
        if (isNaN(p) || p <= 0) {
            setStatusType("error");
            setStatusMessage("Enter a valid trigger price (USD)");
            return;
        }
        if (isNaN(a) || a <= 0) {
            setStatusType("error");
            setStatusMessage("Enter a valid amount");
            return;
        }
        if (total < 10) {
            setStatusType("error");
            setStatusMessage("Minimum order size is $10 USD (Jupiter Trigger V2)");
            return;
        }

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            setCurrentStep("auth");
            setStatusType("info");
            setStatusMessage("Authenticating with Jupiter vault...");
            const jwt = await ensureAuth();

            // Background sync past fills
            fetch("/api/limit/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: publicKey.toString(), jwt }),
            }).catch(() => {});

            const spendToken = isBuy ? quoteToken : baseToken;
            const receiveToken = isBuy ? baseToken : quoteToken;
            const spendAmount = isBuy ? total : a;
            const rawInAmount = Math.floor(spendAmount * Math.pow(10, spendToken.decimals));

            setCurrentStep("craft");
            setStatusMessage("Crafting deposit transaction...");
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
            if (!craftRes.ok) {
                throw new Error(craftData.error || "Failed to craft deposit");
            }

            setCurrentStep("sign");
            setStatusMessage("Sign the deposit transaction in your wallet...");
            const { VersionedTransaction } = await import("@solana/web3.js");
            const tx = VersionedTransaction.deserialize(
                Buffer.from(craftData.transaction, "base64")
            );
            type SupportedTransaction = Parameters<typeof signTransaction>[0];
            const signedTxObj = await signTransaction(tx as SupportedTransaction);
            const signedTxBase64 = Buffer.from(signedTxObj.serialize()).toString("base64");

            let txid = "";
            try {
                const sig = signedTxObj.signatures[0];
                const sigBytes = sig instanceof Uint8Array ? sig : (sig as { signature: Uint8Array }).signature;
                if (sigBytes) txid = bs58.encode(sigBytes);
            } catch {
                /* optional */
            }

            setCurrentStep("send");
            setStatusMessage("Submitting limit order to Jupiter...");
            const selectedExpiry = EXPIRY_OPTIONS.find((o) => o.value === expiry);
            const expirySeconds = selectedExpiry?.seconds ?? 604_800;

            let submitData: Record<string, unknown> = {};
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
                        side,
                        expirySeconds,
                    }),
                });
                const textData = await submitRes.text();
                try {
                    submitData = JSON.parse(textData);
                } catch {
                    submitData = { error: textData.slice(0, 200) };
                }
                if (submitRes.ok) {
                    submitOk = true;
                    break;
                }
                if (submitRes.status === 504 && attempt < 2) {
                    setStatusMessage("Jupiter timed out, retrying...");
                    await new Promise((r) => setTimeout(r, 2000));
                    continue;
                }
                throw new Error(
                    (submitData.error as string) || "Failed to submit limit order"
                );
            }
            if (!submitOk) throw new Error("Failed to submit limit order after retries");

            setCurrentStep("confirm");
            setStatusMessage("Confirming deposit on-chain...");
            try {
                const { Connection } = await import("@solana/web3.js");
                const connection = new Connection(RPC_ENDPOINT, "confirmed");
                const sig = (submitData.txSignature as string) || txid;
                if (sig) {
                    for (let i = 0; i < 12; i++) {
                        await new Promise((r) => setTimeout(r, 2000));
                        const status = await connection.getSignatureStatus(sig);
                        if (
                            status?.value &&
                            (status.value.confirmationStatus === "confirmed" ||
                                status.value.confirmationStatus === "finalized")
                        ) {
                            break;
                        }
                        if (status?.value?.err) {
                            throw new Error(
                                `Deposit failed on-chain: ${JSON.stringify(status.value.err)}`
                            );
                        }
                    }
                }
            } catch (e) {
                console.warn("[LimitOrder] confirmation poll:", e);
            }

            setCurrentStep("");
            setStatusType("success");
            setStatusMessage(
                `✅ ${isBuy ? "Buy" : "Sell"} limit order placed at $${p}${submitData.id ? ` · #${String(submitData.id).slice(0, 8)}` : ""}`
            );
            addLog("info", "Limit order placed", {
                id: submitData.id,
                txSignature: submitData.txSignature || txid,
            });
            window.dispatchEvent(new Event("shx-orders-updated"));
            setAmount("");
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            console.error("[LimitOrder]", error);
            addLog("error", msg, error);
            setStatusType("error");
            if (msg.includes("Failed to execute deposit")) {
                setStatusMessage(
                    "Deposit failed. Ensure you have enough tokens and ~0.01 SOL for fees/rent."
                );
            } else if (msg.toLowerCase().includes("modified")) {
                setStatusMessage(
                    "Wallet modified the transaction. Accept the default fees without editing gas."
                );
            } else {
                setStatusMessage(`Error: ${msg}`);
            }
        } finally {
            setIsSubmitting(false);
            setCurrentStep("");
            setTimeout(() => {
                setStatusMessage((prev) => (prev?.includes("✅") ? null : prev));
            }, 10000);
        }
    }, [
        connected,
        publicKey,
        price,
        amount,
        side,
        baseToken,
        quoteToken,
        total,
        signTransaction,
        isBuy,
        expiry,
        ensureAuth,
        setVisible,
        addLog,
    ]);

    const steps = [
        { id: "auth", label: "Auth" },
        { id: "craft", label: "Craft" },
        { id: "sign", label: "Sign" },
        { id: "send", label: "Submit" },
        { id: "confirm", label: "Confirm" },
    ];

    const busy = isSubmitting || isAuthenticating;

    return (
        <div className="w-full min-h-[420px] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-black/60">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                        <ArrowDownUp size={12} className="text-amber-400" />
                    </div>
                    <span className="font-bold text-sm text-white">Limit Order</span>
                    <span className="text-[10px] text-muted-foreground">Jupiter Trigger V2</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ShieldCheck size={12} className="text-green-400" /> Non-custodial vault
                </div>
            </div>

            <div className="p-4 md:p-5 space-y-4 flex-1">
                {/* Buy / Sell */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <button
                        type="button"
                        onClick={() => setSide("buy")}
                        className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                            side === "buy"
                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                : "text-muted-foreground hover:text-white"
                        }`}
                    >
                        Buy
                    </button>
                    <button
                        type="button"
                        onClick={() => setSide("sell")}
                        className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                            side === "sell"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "text-muted-foreground hover:text-white"
                        }`}
                    >
                        Sell
                    </button>
                </div>

                {/* Pair */}
                <div className="relative space-y-2">
                    <TokenSelector
                        label={isBuy ? "Buy (base)" : "Sell (base)"}
                        value={baseToken}
                        onChange={setBaseToken}
                    />
                    <button
                        type="button"
                        onClick={handleSwapTokens}
                        className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black border border-white/20 flex items-center justify-center hover:bg-white/10"
                        aria-label="Swap tokens"
                    >
                        <ArrowDownUp size={14} className="text-white" />
                    </button>
                    <TokenSelector
                        label={isBuy ? "Pay with (quote)" : "Receive (quote)"}
                        value={quoteToken}
                        onChange={setQuoteToken}
                    />
                </div>

                {/* Price */}
                <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                        Trigger price (USD per {baseToken.symbol})
                    </label>
                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5">
                        <span className="text-muted-foreground text-sm">$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={price}
                            onChange={(e) => handleNumericInput(e.target.value, setPrice)}
                            placeholder="0.00"
                            className="flex-1 bg-transparent text-white font-mono text-sm outline-none"
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-start gap-1">
                        <Info size={10} className="mt-0.5 shrink-0" />
                        {isBuy
                            ? `Buy ${baseToken.symbol} when price falls to or below this USD price.`
                            : `Sell ${baseToken.symbol} when price rises to or above this USD price.`}
                    </p>
                </div>

                {/* Amount */}
                <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                        Amount ({baseToken.symbol})
                    </label>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => handleNumericInput(e.target.value, setAmount)}
                        placeholder="0.00"
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono text-sm outline-none focus:border-primary/40"
                    />
                    {total > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                            Est. {isBuy ? "cost" : "receive"}:{" "}
                            <span className="text-white font-mono">${total.toFixed(2)}</span>{" "}
                            {quoteToken.symbol}
                        </p>
                    )}
                </div>

                {/* Expiry */}
                <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Clock size={10} /> Expiry
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                        {EXPIRY_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setExpiry(opt.value)}
                                className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${
                                    expiry === opt.value
                                        ? "bg-primary/15 border-primary/40 text-primary"
                                        : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-white"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Steps */}
                {busy && currentStep && (
                    <div className="flex items-center justify-between gap-1 px-1">
                        {steps.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-1 flex-1">
                                <div
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        currentStep === s.id
                                            ? "bg-primary/20 text-primary"
                                            : "text-muted-foreground"
                                    }`}
                                >
                                    {s.label}
                                </div>
                                {i < steps.length - 1 && (
                                    <div className="flex-1 h-px bg-white/10" />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Status */}
                {statusMessage && (
                    <div
                        className={`px-3 py-2.5 rounded-xl border text-[12px] font-medium ${
                            statusType === "error"
                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                : statusType === "success"
                                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                                  : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"
                        }`}
                    >
                        {statusMessage}
                    </div>
                )}

                {/* Submit */}
                <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={busy}
                    className={`w-full py-3.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                        isBuy
                            ? "bg-green-500 hover:bg-green-400 text-black"
                            : "bg-red-500 hover:bg-red-400 text-white"
                    }`}
                >
                    {busy ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            {statusMessage?.slice(0, 40) || "Processing..."}
                        </>
                    ) : !connected ? (
                        "Connect Wallet"
                    ) : (
                        `Place ${isBuy ? "Buy" : "Sell"} Limit`
                    )}
                </button>
            </div>
        </div>
    );
}
