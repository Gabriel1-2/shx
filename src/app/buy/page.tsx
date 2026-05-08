"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    CreditCard, ShieldCheck, Zap, Globe,
    Smartphone, Wallet, Info, Loader2, X
} from "lucide-react";

// For the investor pitch, we use MoonPay's Sandbox mode so it renders a fully functional UI
// without needing a real company email or production API keys yet.
const MOONPAY_API_KEY = process.env.NEXT_PUBLIC_MOONPAY_API_KEY || "pk_test_12345";

const PROVIDERS = [
    {
        id: "moonpay",
        name: "MoonPay",
        tagline: "Apple Pay & Google Pay ready",
        fees: "1.5% – 4.5%",
        methods: ["Apple Pay", "Google Pay", "Visa", "Mastercard"],
        speed: "2–5 min",
        color: "from-purple-500 to-violet-600",
        borderColor: "border-purple-500/30",
        bgGlow: "bg-purple-500/10",
        buildEmbedUrl: (wallet: string, amount: number) =>
            `https://sandbox.moonpay.com/buy?apiKey=${MOONPAY_API_KEY}&currencyCode=sol&walletAddress=${wallet}&baseCurrencyAmount=${amount}&colorCode=%2322c55e&theme=dark`,
    },
    {
        id: "stripe",
        name: "Stripe",
        tagline: "Lowest fees, highest limits",
        fees: "0.5% – 2.0%",
        methods: ["Link", "Visa", "Mastercard", "Bank Transfer"],
        speed: "Instant",
        color: "from-indigo-500 to-blue-600",
        borderColor: "border-indigo-500/30",
        bgGlow: "bg-indigo-500/10",
        buildEmbedUrl: (wallet: string, amount: number) =>
            // Stripe requires a backend integration for real usage, so we simulate the MoonPay flow 
            // for the pitch prototype as they function identically in the UI
            `https://sandbox.moonpay.com/buy?apiKey=${MOONPAY_API_KEY}&currencyCode=sol&walletAddress=${wallet}&baseCurrencyAmount=${amount}&colorCode=%236366f1&theme=dark`,
    }
];

const AMOUNTS = [50, 100, 250, 500, 1000];

export default function BuyPage() {
    const { publicKey, connected } = useWallet();
    const [selectedProvider, setSelectedProvider] = useState("moonpay");
    const [amount, setAmount] = useState(100);
    const [customAmount, setCustomAmount] = useState("");
    const [showWidget, setShowWidget] = useState(false);
    const [widgetLoading, setWidgetLoading] = useState(true);

    const provider = PROVIDERS.find((p) => p.id === selectedProvider)!;
    const effectiveAmount = customAmount ? parseFloat(customAmount) || 100 : amount;
    const walletAddr = publicKey?.toBase58() || "";

    const handleLaunchWidget = () => {
        if (!connected) return;
        setWidgetLoading(true);
        setShowWidget(true);
    };

    const embedUrl = connected ? provider.buildEmbedUrl(walletAddr, effectiveAmount) : "";

    return (
        <main className="min-h-screen bg-background relative overflow-hidden pb-20">
            {/* Background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-500/15 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

            {/* ─── Embedded Widget Overlay ─── */}
            {showWidget && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="relative w-full max-w-lg h-[700px] bg-black/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/80">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center`}>
                                    <CreditCard size={12} className="text-white" />
                                </div>
                                <span className="text-sm font-bold text-white">Buy SOL</span>
                                <span className="text-[10px] text-muted-foreground">• ${effectiveAmount} via {provider.name}</span>
                            </div>
                            <button
                                onClick={() => setShowWidget(false)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={16} className="text-muted-foreground" />
                            </button>
                        </div>
                        {widgetLoading && (
                            <div className="absolute inset-0 mt-12 flex items-center justify-center bg-black/90 z-10">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                    <span className="text-sm text-muted-foreground">Loading checkout...</span>
                                </div>
                            </div>
                        )}
                        <iframe
                            src={embedUrl}
                            className="w-full h-[calc(100%-48px)] border-0"
                            onLoad={() => setWidgetLoading(false)}
                            title={`${provider.name} Checkout`}
                            allow="camera;microphone;payment;accelerometer;gyroscope"
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
                        />
                    </div>
                </div>
            )}

            <div className="max-w-3xl mx-auto relative z-10 px-4 md:px-8 pt-8 md:pt-12">
                {/* Hero */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-6">
                        <CreditCard size={14} />
                        FIAT ON-RAMP
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
                        Buy crypto with{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                            Apple Pay.
                        </span>
                    </h1>
                    <p className="text-muted-foreground text-base max-w-xl mx-auto">
                        Purchase SOL directly to your wallet — right here on SHX. Apple Pay, Google Pay, and cards accepted.
                    </p>
                </div>

                {/* Trust Badges */}
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {[
                        { icon: ShieldCheck, label: "Non-Custodial", color: "text-green-400" },
                        { icon: Globe, label: "100+ Countries", color: "text-blue-400" },
                        { icon: Zap, label: "Instant Delivery", color: "text-yellow-400" },
                        { icon: Smartphone, label: "In-App Checkout", color: "text-purple-400" },
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
                            You&apos;ll receive approximately <strong className="text-white">{(effectiveAmount / 170).toFixed(2)} SOL</strong>
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

                    {/* Provider Info */}
                    <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center`}>
                                <CreditCard size={18} className="text-white" />
                            </div>
                            <div>
                                <div className="font-bold text-white text-sm">Powered by {provider.name}</div>
                                <div className="text-[10px] text-muted-foreground">Regulated crypto on-ramp</div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {provider.methods.map((m) => (
                                <span key={m} className="px-2.5 py-1 rounded-lg bg-white/5 text-[10px] text-white border border-white/5 font-medium">
                                    {m}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="p-6">
                        {connected ? (
                            <>
                                <button
                                    onClick={handleLaunchWidget}
                                    className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${provider.color} text-white py-4 rounded-xl font-black text-base transition-all hover:scale-[1.02] shadow-lg hover:shadow-xl`}
                                >
                                    <CreditCard size={18} />
                                    Buy ${effectiveAmount} of SOL
                                </button>
                                <p className="text-center text-[10px] text-muted-foreground mt-3">
                                    SOL delivered to <span className="font-mono text-white">{walletAddr.slice(0, 6)}...{walletAddr.slice(-4)}</span>
                                </p>
                            </>
                        ) : (
                            <div className="text-center py-4">
                                <Wallet size={24} className="text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Connect your wallet to continue</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="mt-6 bg-blue-500/5 border border-blue-500/15 rounded-2xl p-5 flex items-start gap-3">
                    <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                        <strong className="text-white">100% in-app.</strong> The checkout opens directly inside SHX Exchange. Payments are processed securely. SOL lands in your connected wallet within minutes.
                    </div>
                </div>
            </div>
        </main>
    );
}
