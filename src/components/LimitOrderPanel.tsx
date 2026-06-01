"use client";

import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowDownUp, Clock, Loader2 } from "lucide-react";

// Jupiter Trigger Order API v2 endpoint
const TRIGGER_API_ENDPOINT = "https://api.jup.ag/trigger/v2/orders/price";

// Default token pair
const DEFAULT_INPUT_TOKEN = "SHX";
const DEFAULT_OUTPUT_TOKEN = "USDC";

type OrderSide = "buy" | "sell";

interface ExpiryOption {
    label: string;
    value: string;
    seconds: number | null; // null = never
}

const EXPIRY_OPTIONS: ExpiryOption[] = [
    { label: "24 hours", value: "24h", seconds: 86_400 },
    { label: "7 days", value: "7d", seconds: 604_800 },
    { label: "30 days", value: "30d", seconds: 2_592_000 },
    { label: "Never", value: "never", seconds: null },
];

export default function LimitOrderPanel() {
    const { publicKey, connected } = useWallet();
    const { setVisible } = useWalletModal();

    // ─── Form state ──────────────────────────────────────
    const [side, setSide] = useState<OrderSide>("buy");
    const [baseToken, setBaseToken] = useState(DEFAULT_INPUT_TOKEN);
    const [quoteToken, setQuoteToken] = useState(DEFAULT_OUTPUT_TOKEN);
    const [price, setPrice] = useState("");
    const [amount, setAmount] = useState("");
    const [expiry, setExpiry] = useState("7d");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");

    // ─── Computed total ──────────────────────────────────
    const total = useMemo(() => {
        const p = parseFloat(price);
        const a = parseFloat(amount);
        if (!isNaN(p) && !isNaN(a) && p > 0 && a > 0) {
            return p * a;
        }
        return 0;
    }, [price, amount]);

    // ─── Swap pair direction ─────────────────────────────
    const handleSwapTokens = useCallback(() => {
        setBaseToken((prev) => {
            setQuoteToken(prev);
            return quoteToken;
        });
    }, [quoteToken]);

    // ─── Sanitize numeric input ──────────────────────────
    const handleNumericInput = (
        value: string,
        setter: (v: string) => void
    ) => {
        // Allow empty, digits, and one decimal point
        if (value === "" || /^\d*\.?\d*$/.test(value)) {
            setter(value);
        }
    };

    // ─── Submit handler ──────────────────────────────────
    const handlePlaceOrder = useCallback(async () => {
        if (!connected || !publicKey) return;

        const p = parseFloat(price);
        const a = parseFloat(amount);

        if (isNaN(p) || p <= 0) {
            setStatusType("error");
            setStatusMessage("Enter a valid trigger price");
            return;
        }
        if (isNaN(a) || a <= 0) {
            setStatusType("error");
            setStatusMessage("Enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        setStatusMessage(null);

        const selectedExpiry = EXPIRY_OPTIONS.find((o) => o.value === expiry);

        const orderParams = {
            side,
            pair: `${baseToken}/${quoteToken}`,
            triggerPrice: p,
            amount: a,
            totalUSD: total,
            expiry: selectedExpiry?.label ?? "7 days",
            expirySeconds: selectedExpiry?.seconds ?? null,
            wallet: publicKey.toString(),
            apiEndpoint: TRIGGER_API_ENDPOINT,
        };

        console.log("[LimitOrder] Order parameters:", orderParams);

        // Simulate API delay
        await new Promise((r) => setTimeout(r, 800));

        setIsSubmitting(false);
        setStatusType("info");
        setStatusMessage(
            "Limit orders coming soon — Jupiter Trigger API v2 integration in progress"
        );

        // Auto-clear status
        setTimeout(() => setStatusMessage(null), 6000);
    }, [connected, publicKey, price, amount, side, baseToken, quoteToken, expiry, total]);

    // ─── Style helpers ───────────────────────────────────
    const isBuy = side === "buy";
    const accentColor = isBuy ? "green" : "red";

    return (
        <div className="w-full rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl shadow-black/50 overflow-hidden">
            {/* ── Header ───────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center">
                        <div
                            className={`absolute w-5 h-5 blur-sm opacity-50 animate-pulse rounded-full ${
                                isBuy ? "bg-green-500" : "bg-red-500"
                            }`}
                        />
                        <ArrowDownUp
                            className={`relative z-10 ${
                                isBuy ? "text-green-400" : "text-red-400"
                            }`}
                            size={16}
                        />
                    </div>
                    <span
                        className={`font-bold text-sm tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${
                            isBuy
                                ? "from-green-400 to-emerald-500"
                                : "from-red-400 to-rose-500"
                        }`}
                    >
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
                        className={`relative py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 ${
                            isBuy
                                ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 shadow-[inset_0_1px_0_rgba(34,197,94,0.2)]"
                                : "text-muted-foreground hover:text-white/70"
                        }`}
                    >
                        {isBuy && (
                            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-green-500 to-transparent" />
                        )}
                        Buy
                    </button>
                    <button
                        onClick={() => setSide("sell")}
                        className={`relative py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 ${
                            !isBuy
                                ? "bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 shadow-[inset_0_1px_0_rgba(239,68,68,0.2)]"
                                : "text-muted-foreground hover:text-white/70"
                        }`}
                    >
                        {!isBuy && (
                            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                        )}
                        Sell
                    </button>
                </div>

                {/* ── Token Pair ───────────────────────────── */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        Pair
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={baseToken}
                                onChange={(e) =>
                                    setBaseToken(e.target.value.toUpperCase())
                                }
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
                                placeholder="SHX"
                            />
                        </div>
                        <button
                            onClick={handleSwapTokens}
                            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group"
                            title="Swap pair"
                        >
                            <ArrowDownUp
                                size={14}
                                className="text-muted-foreground group-hover:text-white transition-colors rotate-90"
                            />
                        </button>
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={quoteToken}
                                onChange={(e) =>
                                    setQuoteToken(e.target.value.toUpperCase())
                                }
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
                                placeholder="USDC"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Trigger Price ────────────────────────── */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        Trigger Price (USD)
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">
                            $
                        </span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={price}
                            onChange={(e) =>
                                handleNumericInput(e.target.value, setPrice)
                            }
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-7 pr-3 py-2.5 text-sm font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {/* ── Amount ───────────────────────────────── */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        Amount
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) =>
                                handleNumericInput(e.target.value, setAmount)
                            }
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm font-mono font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all pr-16"
                            placeholder="0.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-mono font-medium">
                            {baseToken}
                        </span>
                    </div>
                </div>

                {/* ── Total Display ────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        Total
                    </span>
                    <span
                        className={`text-base font-mono font-bold ${
                            total > 0
                                ? isBuy
                                    ? "text-green-400"
                                    : "text-red-400"
                                : "text-white/30"
                        }`}
                    >
                        $
                        {total > 0
                            ? total.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6,
                              })
                            : "0.00"}
                    </span>
                </div>

                {/* ── Expiry ───────────────────────────────── */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        <Clock size={11} />
                        Expiry
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        {EXPIRY_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setExpiry(opt.value)}
                                className={`py-2 rounded-lg text-[11px] font-bold tracking-wide transition-all duration-200 ${
                                    expiry === opt.value
                                        ? `bg-white/[0.08] text-white border border-white/[0.12] shadow-sm`
                                        : "text-muted-foreground hover:text-white/60 border border-transparent"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Status Message ───────────────────────── */}
                {statusMessage && (
                    <div
                        className={`px-4 py-3 rounded-xl border text-[12px] font-medium transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${
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

                {/* ── Submit Button ─────────────────────────── */}
                {connected ? (
                    <button
                        onClick={handlePlaceOrder}
                        disabled={isSubmitting}
                        className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                            isBuy
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-black hover:from-green-400 hover:to-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_30px_rgba(34,197,94,0.35)]"
                                : "bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-400 hover:to-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:shadow-[0_0_30px_rgba(239,68,68,0.35)]"
                        }`}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                Placing Order...
                            </span>
                        ) : (
                            `Place Limit ${isBuy ? "Buy" : "Sell"} Order`
                        )}
                    </button>
                ) : (
                    <button
                        onClick={() => setVisible(true)}
                        className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-primary to-lime-400 text-black hover:opacity-90 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    >
                        Connect Wallet
                    </button>
                )}
            </div>

            {/* ── Footer Trust Info ─────────────────────────── */}
            <div className="flex items-center justify-center gap-4 px-5 py-3 border-t border-white/[0.06] bg-black/40">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                        On-Chain
                    </span>
                </div>
                <div className="h-3 w-px bg-white/10" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    Non-Custodial
                </span>
                <div className="h-3 w-px bg-white/10" />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    Jupiter Powered
                </span>
            </div>
        </div>
    );
}
