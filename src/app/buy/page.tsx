"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    CreditCard, ArrowRight, ShieldCheck, Zap, Globe,
    ChevronDown, ExternalLink, Smartphone, Wallet, Info
} from "lucide-react";

const PROVIDERS = [
    {
        id: "moonpay",
        name: "MoonPay",
        tagline: "Trusted by 20M+ users",
        fees: "1.5% – 4.5%",
        methods: ["Visa", "Mastercard", "Apple Pay", "Google Pay", "Bank Transfer"],
        currencies: ["USD", "EUR", "GBP", "CAD", "AUD"],
        minBuy: "$30",
        speed: "2–5 min",
        color: "from-purple-500 to-violet-600",
        borderColor: "border-purple-500/30",
        bgGlow: "bg-purple-500/10",
        url: "https://www.moonpay.com/buy/sol",
        buildUrl: (wallet: string, amount: number) =>
            `https://www.moonpay.com/buy/sol?walletAddress=${wallet}&defaultCurrencyCode=sol&baseCurrencyAmount=${amount}&colorCode=%2322c55e`,
    },
    {
        id: "transak",
        name: "Transak",
        tagline: "100+ countries supported",
        fees: "1% – 5%",
        methods: ["Visa", "Mastercard", "Apple Pay", "Bank Transfer", "Sepa"],
        currencies: ["USD", "EUR", "GBP", "INR", "BRL"],
        minBuy: "$15",
        speed: "1–10 min",
        color: "from-blue-500 to-cyan-500",
        borderColor: "border-blue-500/30",
        bgGlow: "bg-blue-500/10",
        url: "https://global.transak.com/",
        buildUrl: (wallet: string, amount: number) =>
            `https://global.transak.com/?apiKey=TRANSAK_API_KEY&cryptoCurrencyCode=SOL&defaultCryptoAmount=${amount}&walletAddress=${wallet}&themeColor=22c55e&network=solana`,
    },
    {
        id: "ramp",
        name: "Ramp Network",
        tagline: "Fastest checkout flow",
        fees: "0.49% – 2.49%",
        methods: ["Visa", "Mastercard", "Apple Pay", "Bank Transfer"],
        currencies: ["USD", "EUR", "GBP"],
        minBuy: "$5",
        speed: "Instant – 5 min",
        color: "from-green-500 to-emerald-500",
        borderColor: "border-green-500/30",
        bgGlow: "bg-green-500/10",
        url: "https://ramp.network/buy",
        buildUrl: (wallet: string, amount: number) =>
            `https://app.ramp.network/?hostApiKey=RAMP_API_KEY&swapAsset=SOLANA_SOL&fiatValue=${amount}&userAddress=${wallet}`,
    },
];

const AMOUNTS = [50, 100, 250, 500, 1000];

export default function BuyPage() {
    const { publicKey, connected } = useWallet();
    const [selectedProvider, setSelectedProvider] = useState("moonpay");
    const [amount, setAmount] = useState(100);
    const [customAmount, setCustomAmount] = useState("");

    const provider = PROVIDERS.find((p) => p.id === selectedProvider)!;
    const effectiveAmount = customAmount ? parseFloat(customAmount) : amount;
    const walletAddr = publicKey?.toBase58() || "";

    const handleBuy = () => {
        if (!connected) return;
        const url = provider.buildUrl(walletAddr, effectiveAmount);
        window.open(url, "_blank", "noopener,noreferrer");
    };

    return (
        <main className="min-h-screen bg-background relative overflow-hidden pb-20">
            {/* Background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-500/15 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10 px-4 md:px-8 pt-8 md:pt-12">
                {/* Hero */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-6">
                        <CreditCard size={14} />
                        FIAT ON-RAMP
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
                        Buy SOL with{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                            your card.
                        </span>
                    </h1>
                    <p className="text-muted-foreground text-base max-w-xl mx-auto">
                        Purchase SOL directly to your wallet using a credit card, Apple Pay, or bank transfer. Then swap for any token on SHX.
                    </p>
                </div>

                {/* Trust Badges */}
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {[
                        { icon: ShieldCheck, label: "Non-Custodial", color: "text-green-400" },
                        { icon: Globe, label: "100+ Countries", color: "text-blue-400" },
                        { icon: Zap, label: "Instant Delivery", color: "text-yellow-400" },
                        { icon: Smartphone, label: "Mobile Friendly", color: "text-purple-400" },
                    ].map((b, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                            <b.icon size={12} className={b.color} />
                            <span className="text-[10px] md:text-xs font-medium text-white">{b.label}</span>
                        </div>
                    ))}
                </div>

                {/* Main Card */}
                <div className="bg-black/60 border border-white/10 rounded-2xl backdrop-blur-xl overflow-hidden shadow-2xl">
                    {/* Amount Selector */}
                    <div className="p-6 border-b border-white/5">
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-3 block">
                            Select Amount (USD)
                        </label>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {AMOUNTS.map((a) => (
                                <button
                                    key={a}
                                    onClick={() => { setAmount(a); setCustomAmount(""); }}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                        amount === a && !customAmount
                                            ? "bg-primary text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                                            : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                                    }`}
                                >
                                    ${a}
                                </button>
                            ))}
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                <input
                                    type="number"
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    placeholder="Other"
                                    className="w-24 bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2 text-sm text-white placeholder-muted-foreground outline-none focus:border-primary transition-colors"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            You&apos;ll receive approximately <strong className="text-white">{(effectiveAmount / 170).toFixed(2)} SOL</strong> at current prices
                        </p>
                    </div>

                    {/* Provider Selection */}
                    <div className="p-6 border-b border-white/5">
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-3 block">
                            Choose Provider
                        </label>
                        <div className="space-y-3">
                            {PROVIDERS.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedProvider(p.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                                        selectedProvider === p.id
                                            ? `${p.borderColor} ${p.bgGlow}`
                                            : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/5"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                                            <CreditCard size={18} className="text-white" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-white text-sm flex items-center gap-2">
                                                {p.name}
                                                {selectedProvider === p.id && (
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                )}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">{p.tagline}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-white font-mono">{p.fees}</div>
                                        <div className="text-[10px] text-muted-foreground">{p.speed}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Provider Details */}
                    <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase mb-1">Payment Methods</p>
                                <div className="flex flex-wrap gap-1">
                                    {provider.methods.map((m) => (
                                        <span key={m} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-white border border-white/5">
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase mb-1">Currencies</p>
                                <div className="flex flex-wrap gap-1">
                                    {provider.currencies.map((c) => (
                                        <span key={c} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-white border border-white/5">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="p-6">
                        {connected ? (
                            <button
                                onClick={handleBuy}
                                className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${provider.color} text-white py-4 rounded-xl font-black text-base transition-all hover:scale-[1.02] shadow-lg hover:shadow-xl`}
                            >
                                Buy ${effectiveAmount} of SOL via {provider.name}
                                <ExternalLink size={16} />
                            </button>
                        ) : (
                            <div className="text-center py-4">
                                <Wallet size={24} className="text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Connect your wallet to continue</p>
                                <p className="text-xs text-muted-foreground mt-1">SOL will be delivered directly to your connected wallet</p>
                            </div>
                        )}
                        {connected && (
                            <p className="text-center text-[10px] text-muted-foreground mt-3">
                                SOL will be delivered to <span className="font-mono text-white">{walletAddr.slice(0, 6)}...{walletAddr.slice(-4)}</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="mt-6 bg-blue-500/5 border border-blue-500/15 rounded-2xl p-5 flex items-start gap-3">
                    <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                        <strong className="text-white">How it works:</strong> You&apos;ll be redirected to a regulated third-party provider to complete your purchase. SHX Exchange never touches your payment info — SOL is sent directly from the provider to your Solana wallet. Once received, come back and swap for any token.
                    </div>
                </div>
            </div>
        </main>
    );
}
