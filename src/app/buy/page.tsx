"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Script from "next/script";
import {
    CreditCard, ShieldCheck, Zap, Globe,
    Smartphone, Wallet, Info, Loader2, X, AlertTriangle
} from "lucide-react";

/*
 * ─── CONFIGURATION ───
 * Add these to your .env.local (and Vercel environment variables):
 *
 *   NEXT_PUBLIC_MOONPAY_API_KEY=pk_live_xxxxxxxx      (from dashboard.moonpay.com)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxx (from dashboard.stripe.com)
 *   STRIPE_SECRET_KEY=sk_live_xxxxxxx                  (server-side only, for API route)
 */

const MOONPAY_API_KEY = process.env.NEXT_PUBLIC_MOONPAY_API_KEY || "";
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

const AMOUNTS = [50, 100, 250, 500, 1000];

function useSolPrice() {
    const [price, setPrice] = useState(170);
    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
                const data = await res.json();
                if (data.solana?.usd) setPrice(data.solana.usd);
            } catch {}
        };
        fetchPrice();
        const interval = setInterval(fetchPrice, 60000);
        return () => clearInterval(interval);
    }, []);
    return price;
}

// ─── MoonPay Widget ─────────────────────────────────────────────
function MoonPayWidget({ wallet, amount, onClose }: { wallet: string; amount: number; onClose: () => void }) {
    const [loading, setLoading] = useState(true);

    const embedUrl = `https://buy.moonpay.com/?apiKey=${MOONPAY_API_KEY}&currencyCode=sol&walletAddress=${wallet}&baseCurrencyAmount=${amount}&colorCode=%2322c55e&theme=dark&showOnlyCurrencies=sol`;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4">
            <div className="relative w-full max-w-lg h-[min(92dvh,700px)] sm:h-[700px] bg-black/95 border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl pb-[env(safe-area-inset-bottom)]">
                <div className="sm:hidden flex justify-center pt-2">
                    <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/80">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                            <CreditCard size={12} className="text-white" />
                        </div>
                        <span className="text-sm font-bold text-white">Buy SOL</span>
                        <span className="text-[10px] text-muted-foreground">• MoonPay</span>
                    </div>
                    <button onClick={onClose} className="p-2 active:bg-white/10 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
                        <X size={16} className="text-muted-foreground" />
                    </button>
                </div>
                {loading && (
                    <div className="absolute inset-0 mt-12 flex items-center justify-center bg-black/90 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <span className="text-sm text-muted-foreground">Loading MoonPay...</span>
                        </div>
                    </div>
                )}
                <iframe
                    src={embedUrl}
                    className="w-full h-[calc(100%-48px)] border-0"
                    onLoad={() => setLoading(false)}
                    title="MoonPay Buy SOL"
                    allow="accelerometer; autoplay; camera; gyroscope; payment; microphone"
                />
            </div>
        </div>
    );
}

// ─── Stripe Crypto Onramp Widget ────────────────────────────────
function StripeWidget({ wallet, amount, onClose }: { wallet: string; amount: number; onClose: () => void }) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        async function initStripe() {
            try {
                // 1. Create session via our backend
                const res = await fetch("/api/onramp/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ wallet_address: wallet, amount }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    setError(data.error || "Failed to create session");
                    setLoading(false);
                    return;
                }

                const { client_secret } = await res.json();

                // 2. Wait for Stripe SDK to be available
                const waitForStripe = () => new Promise<void>((resolve) => {
                    const check = () => {
                        if ((window as any).StripeOnramp) { resolve(); return; }
                        setTimeout(check, 100);
                    };
                    check();
                });
                await waitForStripe();

                // 3. Initialize and mount the widget
                const stripeOnramp = (window as any).StripeOnramp(STRIPE_PK);
                const session = stripeOnramp.createSession({ clientSecret: client_secret });

                session.addEventListener("onramp_session_updated", (e: any) => {
                    console.log("[Stripe Onramp] Session updated:", e.payload.session.status);
                });

                if (mountRef.current) {
                    session.mount(mountRef.current);
                    setLoading(false);
                }
            } catch (err) {
                console.error("[Stripe Onramp] Error:", err);
                setError("Failed to initialize Stripe checkout");
                setLoading(false);
            }
        }

        initStripe();
    }, [wallet, amount]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4">
            <Script src="https://js.stripe.com/v3/" strategy="afterInteractive" />
            <Script src="https://crypto-js.stripe.com/crypto-onramp-outer.js" strategy="afterInteractive" />

            <div className="relative w-full max-w-lg h-[min(92dvh,700px)] sm:h-[700px] bg-black/95 border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl pb-[env(safe-area-inset-bottom)]">
                <div className="sm:hidden flex justify-center pt-2">
                    <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/80">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                            <CreditCard size={12} className="text-white" />
                        </div>
                        <span className="text-sm font-bold text-white">Buy SOL</span>
                        <span className="text-[10px] text-muted-foreground">• Stripe</span>
                    </div>
                    <button onClick={onClose} className="p-2 active:bg-white/10 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
                        <X size={16} className="text-muted-foreground" />
                    </button>
                </div>

                {loading && !error && (
                    <div className="absolute inset-0 mt-12 flex items-center justify-center bg-black/90 z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <span className="text-sm text-muted-foreground">Loading Stripe...</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 mt-12 flex items-center justify-center bg-black/90 z-10">
                        <div className="flex flex-col items-center gap-3 max-w-xs text-center">
                            <AlertTriangle size={32} className="text-yellow-400" />
                            <p className="text-sm text-white font-bold">Stripe Not Available</p>
                            <p className="text-xs text-muted-foreground">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm text-white transition-colors"
                            >
                                Use MoonPay Instead
                            </button>
                        </div>
                    </div>
                )}

                {/* Stripe mounts its widget here */}
                <div ref={mountRef} className="w-full h-[calc(100%-48px)]" />
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function BuyPage() {
    const { publicKey, connected } = useWallet();
    const [selectedProvider, setSelectedProvider] = useState("moonpay");
    const solPrice = useSolPrice();
    const [amount, setAmount] = useState(100);
    const [customAmount, setCustomAmount] = useState("");
    const [showWidget, setShowWidget] = useState(false);

    const effectiveAmount = customAmount ? parseFloat(customAmount) || 100 : amount;
    const walletAddr = publicKey?.toBase58() || "";

    const moonpayReady = MOONPAY_API_KEY.length > 5;
    const stripeReady = STRIPE_PK.length > 5;

    const providers = [
        {
            id: "moonpay",
            name: "MoonPay",
            tagline: "Apple Pay, Google Pay, and cards",
            fees: "1.5% – 4.5%",
            methods: ["Apple Pay", "Google Pay", "Visa", "Mastercard"],
            speed: "2–5 min",
            color: "from-purple-500 to-violet-600",
            borderColor: "border-purple-500/30",
            bgGlow: "bg-purple-500/10",
            ready: moonpayReady,
        },
        {
            id: "stripe",
            name: "Stripe",
            tagline: "Link, cards, and bank transfers",
            fees: "0.5% – 2.0%",
            methods: ["Link", "Visa", "Mastercard", "Bank"],
            speed: "Instant",
            color: "from-indigo-500 to-blue-600",
            borderColor: "border-indigo-500/30",
            bgGlow: "bg-indigo-500/10",
            ready: stripeReady,
        },
    ];

    const provider = providers.find((p) => p.id === selectedProvider)!;

    return (
        <main className="min-h-screen bg-background relative overflow-x-hidden pb-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] md:w-[800px] h-[220px] md:h-[400px] bg-purple-500/15 blur-[100px] md:blur-[150px] rounded-full pointer-events-none" />

            {showWidget && selectedProvider === "moonpay" && moonpayReady && (
                <MoonPayWidget wallet={walletAddr} amount={effectiveAmount} onClose={() => setShowWidget(false)} />
            )}
            {showWidget && selectedProvider === "stripe" && stripeReady && (
                <StripeWidget wallet={walletAddr} amount={effectiveAmount} onClose={() => setShowWidget(false)} />
            )}

            <div className="max-w-3xl mx-auto relative z-10 px-3 md:px-8 pt-3 md:pt-12">
                <div className="text-center mb-6 md:mb-10">
                    <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] md:text-xs font-bold mb-3 md:mb-6">
                        <CreditCard size={12} />
                        FIAT ON-RAMP
                    </div>
                    <h1 className="text-xl md:text-5xl font-black text-white tracking-tight mb-2 md:mb-4">
                        Buy crypto with{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                            Apple Pay.
                        </span>
                    </h1>
                    <p className="text-muted-foreground text-base max-w-xl mx-auto">
                        Purchase SOL directly to your wallet — right here on SHX. Apple Pay, Google Pay, and cards accepted.
                        Then swap into SHX at <span className="text-primary font-bold">0% platform fee</span>.
                    </p>
                </div>

                {/* One-flow: fiat → SHX */}
                <div className="mb-8 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 to-emerald-500/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-black text-white">Elite path: Buy SOL → Buy SHX 0%</p>
                        <p className="text-xs text-muted-foreground">
                            On-ramp here, then one tap to SHX with no platform fee. Hold SHX → lower trading fees forever.
                        </p>
                    </div>
                    <a
                        href="/?output=336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q&focus=shx"
                        className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-black text-xs font-black hover:opacity-90"
                    >
                        Step 2 · Buy SHX 0% →
                    </a>
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
                            You&apos;ll receive approximately <strong className="text-white">{(effectiveAmount / solPrice).toFixed(4)} SOL</strong>
                            <span className="ml-1 text-muted-foreground/50">(@ ${solPrice.toFixed(0)}/SOL)</span>
                        </p>
                    </div>

                    {/* Provider Selection */}
                    <div className="p-6 border-b border-white/5">
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-3 block">
                            Choose Provider
                        </label>
                        <div className="space-y-3">
                            {providers.map((p) => (
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
                                                {p.ready ? (
                                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                                ) : (
                                                    <span className="text-[9px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">Setup needed</span>
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

                    {/* Payment Methods */}
                    <div className="p-6 border-b border-white/5 bg-white/[0.01]">
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
                        {!connected ? (
                            <div className="text-center py-4">
                                <Wallet size={24} className="text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Connect your wallet to continue</p>
                            </div>
                        ) : !provider.ready ? (
                            <div className="text-center py-4">
                                <AlertTriangle size={24} className="text-yellow-400 mx-auto mb-2" />
                                <p className="text-sm text-white font-bold mb-1">{provider.name} API key not configured</p>
                                <p className="text-xs text-muted-foreground">
                                    Add <code className="text-primary bg-primary/10 px-1 py-0.5 rounded text-[10px]">
                                        {selectedProvider === "moonpay" ? "NEXT_PUBLIC_MOONPAY_API_KEY" : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"}
                                    </code> to your environment variables
                                </p>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => setShowWidget(true)}
                                    className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${provider.color} text-white py-4 rounded-xl font-black text-base transition-all hover:scale-[1.02] shadow-lg hover:shadow-xl`}
                                >
                                    <CreditCard size={18} />
                                    Buy ${effectiveAmount} of SOL
                                </button>
                                <p className="text-center text-[10px] text-muted-foreground mt-3">
                                    SOL delivered to <span className="font-mono text-white">{walletAddr.slice(0, 6)}...{walletAddr.slice(-4)}</span>
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="mt-6 bg-blue-500/5 border border-blue-500/15 rounded-2xl p-5 flex items-start gap-3">
                    <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                        <strong className="text-white">100% in-app.</strong> The checkout opens directly inside SHX. Your payment provider handles KYC, compliance, and card processing. SOL lands in your connected wallet within minutes.
                    </div>
                </div>
            </div>
        </main>
    );
}
