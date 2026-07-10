"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { RefreshCw, Clock, Loader2, Info, ShieldCheck, ArrowDownUp } from "lucide-react";
import { APP_TOKENS, TokenInfo } from "@/lib/constants";
import TokenSelector from "./TokenSelector";
import { useDebugLogs } from "./DebugLogs";

const INTERVALS = [
    { label: "Hourly", value: 3600 },
    { label: "Daily", value: 86400 },
    { label: "Weekly", value: 604800 },
    { label: "Monthly", value: 2_592_000 },
];

const RPC_ENDPOINT =
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com";

/** Jupiter Recurring requires ~$100 minimum order notional */
const MIN_ORDER_USD = 100;

export default function DCAPanel() {
    const { connected, publicKey, signTransaction, sendTransaction } = useWallet();
    const { setVisible } = useWalletModal();
    const { addLog } = useDebugLogs();

    const [spendToken, setSpendToken] = useState<TokenInfo>(
        APP_TOKENS.find((t) => t.symbol === "USDC") || APP_TOKENS[1]
    );
    const [receiveToken, setReceiveToken] = useState<TokenInfo>(
        APP_TOKENS.find((t) => t.symbol === "SHX") || APP_TOKENS[0]
    );
    const [totalAmount, setTotalAmount] = useState("");
    const [numberOfOrders, setNumberOfOrders] = useState("7");
    const [selectedInterval, setSelectedInterval] = useState(INTERVALS[1]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
    const [currentStep, setCurrentStep] = useState<"create" | "sign" | "execute" | "">("");

    const perOrder =
        totalAmount && numberOfOrders
            ? (parseFloat(totalAmount) / parseInt(numberOfOrders, 10)).toFixed(4)
            : "0";

    const totalDuration = numberOfOrders
        ? parseInt(numberOfOrders, 10) * selectedInterval.value
        : 0;

    const formatDuration = (seconds: number) => {
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days`;
        return `${(seconds / 604800).toFixed(1)} weeks`;
    };

    const handleNumericInput = (value: string, setter: (v: string) => void) => {
        if (value === "" || /^\d*\.?\d*$/.test(value)) setter(value);
    };

    const swapPair = () => {
        setSpendToken((prev) => {
            setReceiveToken(prev);
            return receiveToken;
        });
    };

    const handleSubmit = async () => {
        if (!connected || !publicKey) {
            setVisible(true);
            return;
        }
        if (!signTransaction && !sendTransaction) {
            setStatusType("error");
            setStatus("Wallet cannot sign transactions");
            return;
        }

        const parsedAmount = parseFloat(totalAmount);
        const nOrders = parseInt(numberOfOrders, 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setStatusType("error");
            setStatus("Enter a valid total amount");
            return;
        }
        if (isNaN(nOrders) || nOrders < 2) {
            setStatusType("error");
            setStatus("Need at least 2 orders for DCA");
            return;
        }

        // Stablecoin path: enforce Jupiter $100 min
        if (
            (spendToken.symbol === "USDC" || spendToken.symbol === "USDT") &&
            parsedAmount < MIN_ORDER_USD
        ) {
            setStatusType("error");
            setStatus(
                `Jupiter requires at least $${MIN_ORDER_USD} total deposit. Current: $${parsedAmount.toFixed(2)}.`
            );
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        try {
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
                    numberOfOrders: nOrders.toString(),
                    interval: selectedInterval.value.toString(),
                }),
            });

            const createData = await createRes.json();
            if (!createRes.ok) {
                throw new Error(createData.error || "Failed to create DCA order");
            }
            if (!createData.transaction || !createData.requestId) {
                throw new Error("Invalid create response from Jupiter");
            }

            setCurrentStep("sign");
            setStatus("Sign the DCA deposit in your wallet...");
            const { VersionedTransaction, Connection } = await import("@solana/web3.js");
            const connection = new Connection(RPC_ENDPOINT, "confirmed");
            const tx = VersionedTransaction.deserialize(
                Buffer.from(createData.transaction, "base64")
            );

            let signedTxBase64: string;
            if (signTransaction) {
                type ST = Parameters<typeof signTransaction>[0];
                const signed = await signTransaction(tx as ST);
                signedTxBase64 = Buffer.from(signed.serialize()).toString("base64");
            } else {
                // Fallback: send via wallet (skip Jupiter execute)
                const txid = await sendTransaction!(tx, connection);
                setCurrentStep("execute");
                setStatus("Confirming on-chain...");
                await connection.confirmTransaction(txid, "confirmed");
                setCurrentStep("");
                setStatusType("success");
                setStatus(
                    `✅ DCA activated — ${perOrder} ${spendToken.symbol} → ${receiveToken.symbol} ${selectedInterval.label.toLowerCase()}`
                );
                addLog("info", "DCA placed", { txid });
                window.dispatchEvent(new Event("shx-orders-updated"));
                return;
            }

            setCurrentStep("execute");
            setStatus("Submitting to Jupiter...");
            const execRes = await fetch("/api/dca/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "execute",
                    signedTransaction: signedTxBase64,
                    requestId: createData.requestId,
                }),
            });
            const execData = await execRes.json();
            if (!execRes.ok) {
                // Fallback: send signed tx ourselves if execute fails
                console.warn("[DCA] execute failed, falling back to RPC send", execData);
                const signed = VersionedTransaction.deserialize(
                    Buffer.from(signedTxBase64, "base64")
                );
                const txid = await connection.sendRawTransaction(signed.serialize(), {
                    skipPreflight: false,
                });
                await connection.confirmTransaction(txid, "confirmed");
            }

            setCurrentStep("");
            setStatusType("success");
            setStatus(
                `✅ DCA activated — spending ${perOrder} ${spendToken.symbol} on ${receiveToken.symbol} ${selectedInterval.label.toLowerCase()} for ~${formatDuration(totalDuration)}`
            );
            addLog("info", "DCA placed", execData);
            window.dispatchEvent(new Event("shx-orders-updated"));
            // Best-effort sync
            fetch("/api/dca/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: publicKey.toString() }),
            }).catch(() => {});
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            setStatusType("error");
            setStatus(`Error: ${msg}`);
            addLog("error", msg, e);
        } finally {
            setIsSubmitting(false);
            setCurrentStep("");
            setTimeout(() => {
                setStatus((prev) => (prev?.includes("✅") ? null : prev));
            }, 10000);
        }
    };

    const steps = [
        { id: "create", label: "Create" },
        { id: "sign", label: "Sign" },
        { id: "execute", label: "Execute" },
    ];

    return (
        <div className="w-full min-h-[420px] rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-black/60">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                        <RefreshCw size={12} className="text-blue-400" />
                    </div>
                    <span className="font-bold text-sm text-white">DCA</span>
                    <span className="text-[10px] text-muted-foreground">Jupiter Recurring</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ShieldCheck size={12} className="text-green-400" /> Self-custody
                </div>
            </div>

            <div className="p-4 md:p-5 space-y-4 flex-1">
                <div className="relative space-y-2">
                    <TokenSelector label="Spend" value={spendToken} onChange={setSpendToken} />
                    <button
                        type="button"
                        onClick={swapPair}
                        className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black border border-white/20 flex items-center justify-center hover:bg-white/10"
                        aria-label="Swap pair"
                    >
                        <ArrowDownUp size={14} className="text-white" />
                    </button>
                    <TokenSelector
                        label="Receive"
                        value={receiveToken}
                        onChange={setReceiveToken}
                    />
                </div>

                <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                        Total amount ({spendToken.symbol})
                    </label>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={totalAmount}
                        onChange={(e) => handleNumericInput(e.target.value, setTotalAmount)}
                        placeholder="0.00"
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono text-sm outline-none focus:border-primary/40"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-start gap-1">
                        <Info size={10} className="mt-0.5 shrink-0" />
                        Min ~${MIN_ORDER_USD} total deposit (Jupiter). Fee: 0.1% on fills.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                            # of orders
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={numberOfOrders}
                            onChange={(e) => {
                                if (e.target.value === "" || /^\d+$/.test(e.target.value)) {
                                    setNumberOfOrders(e.target.value);
                                }
                            }}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono text-sm outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
                            Per order
                        </label>
                        <div className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2.5 text-white/80 font-mono text-sm">
                            {perOrder} {spendToken.symbol}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Clock size={10} /> Interval
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                        {INTERVALS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setSelectedInterval(opt)}
                                className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${
                                    selectedInterval.value === opt.value
                                        ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                                        : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-white"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {totalDuration > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-2">
                            Duration ≈{" "}
                            <span className="text-white font-medium">
                                {formatDuration(totalDuration)}
                            </span>
                        </p>
                    )}
                </div>

                {isSubmitting && currentStep && (
                    <div className="flex items-center justify-between gap-1">
                        {steps.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-1 flex-1">
                                <div
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        currentStep === s.id
                                            ? "bg-blue-500/20 text-blue-400"
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

                {status && (
                    <div
                        className={`px-3 py-2.5 rounded-xl border text-[12px] font-medium ${
                            statusType === "error"
                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                : statusType === "success"
                                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                                  : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"
                        }`}
                    >
                        {status}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl font-black text-sm bg-blue-500 hover:bg-blue-400 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Processing...
                        </>
                    ) : !connected ? (
                        "Connect Wallet"
                    ) : (
                        "Start DCA Strategy"
                    )}
                </button>
            </div>
        </div>
    );
}
