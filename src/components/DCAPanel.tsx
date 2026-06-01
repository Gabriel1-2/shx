"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { RefreshCw, Clock, TrendingUp, Loader2, Info } from "lucide-react";
import { SHULEVITZ_MINT } from "@/lib/constants";

const TOKENS = [
    { symbol: "SHX", name: "Shulevitz", mint: SHULEVITZ_MINT },
    { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112" },
    { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
    { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
];

const INTERVALS = [
    { label: "Every Minute", value: 60 },
    { label: "Every Hour", value: 3600 },
    { label: "Every Day", value: 86400 },
    { label: "Every Week", value: 604800 },
];

const SPEND_TOKENS = [
    { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
    { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" },
    { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
];

export default function DCAPanel() {
    const { connected, publicKey } = useWallet();
    const { setVisible } = useWalletModal();

    const [spendToken, setSpendToken] = useState(SPEND_TOKENS[0]);
    const [receiveToken, setReceiveToken] = useState(TOKENS[0]);
    const [totalAmount, setTotalAmount] = useState("");
    const [numberOfOrders, setNumberOfOrders] = useState("7");
    const [interval, setInterval] = useState(INTERVALS[2]); // Daily
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const perOrder = totalAmount && numberOfOrders
        ? (parseFloat(totalAmount) / parseInt(numberOfOrders)).toFixed(4)
        : "0";

    const totalDuration = numberOfOrders
        ? parseInt(numberOfOrders) * interval.value
        : 0;

    const formatDuration = (seconds: number) => {
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days`;
        return `${Math.floor(seconds / 604800)} weeks`;
    };

    const handleSubmit = async () => {
        if (!connected || !publicKey) return;
        setIsSubmitting(true);
        setStatus(null);

        try {
            // Jupiter Recurring API v1
            const orderParams = {
                user: publicKey.toString(),
                inputMint: spendToken.mint,
                outputMint: receiveToken.mint,
                params: {
                    time: {
                        inAmount: totalAmount,
                        numberOfOrders: parseInt(numberOfOrders),
                        interval: interval.value,
                        minPrice: null,
                        maxPrice: null,
                        startAt: null,
                    }
                }
            };

            console.log("[DCA] Order params:", orderParams);
            setStatus("DCA orders launching soon — Jupiter Recurring API integration in progress");
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

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
                <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        You Spend
                    </label>
                    <div className="flex gap-2">
                        <select
                            value={spendToken.symbol}
                            onChange={(e) => setSpendToken(SPEND_TOKENS.find(t => t.symbol === e.target.value)!)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                        >
                            {SPEND_TOKENS.map(t => (
                                <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            placeholder="Total amount"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Receive Token */}
                <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        You Receive
                    </label>
                    <select
                        value={receiveToken.symbol}
                        onChange={(e) => setReceiveToken(TOKENS.find(t => t.symbol === e.target.value)!)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                    >
                        {TOKENS.map(t => (
                            <option key={t.symbol} value={t.symbol}>{t.symbol} — {t.name}</option>
                        ))}
                    </select>
                </div>

                {/* Frequency */}
                <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        <Clock size={10} className="inline mr-1" />
                        Frequency
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {INTERVALS.map(i => (
                            <button
                                key={i.value}
                                onClick={() => setInterval(i)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                    interval.value === i.value
                                        ? "bg-blue-500/20 border border-blue-500/50 text-blue-400"
                                        : "bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                                }`}
                            >
                                {i.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Number of Orders */}
                <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        Number of Orders
                    </label>
                    <input
                        type="number"
                        min="2"
                        max="999"
                        value={numberOfOrders}
                        onChange={(e) => setNumberOfOrders(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                </div>

                {/* Summary */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
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
                            Buy {perOrder} {spendToken.symbol} of {receiveToken.symbol} {interval.label.toLowerCase()}
                        </span>
                    </div>
                </div>

                {/* Submit */}
                {connected ? (
                    <button
                        onClick={handleSubmit}
                        disabled={!totalAmount || !numberOfOrders || isSubmitting}
                        className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                    >
                        Connect Wallet to Start DCA
                    </button>
                )}

                {/* Status */}
                {status && (
                    <div className="text-xs text-center text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}
