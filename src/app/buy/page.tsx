"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    CreditCard, ShieldCheck, Zap, Globe,
    Smartphone, Wallet, Info, Loader2, X, Copy, Check, ExternalLink
} from "lucide-react";

/*
 * ─── HOW TO SET UP ───
 * 1. Go to https://dashboard.transak.com and create a free account
 * 2. In the dashboard, go to Developers → Copy your API Key
 * 3. Add it to your .env.local:  NEXT_PUBLIC_TRANSAK_API_KEY=your-key-here
 * 4. Restart the dev server
 * 
 * That's it! The widget will embed directly on this page.
 */

const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY || "";
const AMOUNTS = [50, 100, 250, 500, 1000];

function buildTransakUrl(wallet: string, amount: number, isStaging: boolean) {
    const base = isStaging
        ? "https://global-stg.transak.com"
        : "https://global.transak.com";

    const params = new URLSearchParams({
        apiKey: TRANSAK_API_KEY,
        cryptoCurrencyCode: "SOL",
        network: "solana",
        defaultFiatAmount: amount.toString(),
        fiatCurrency: "USD",
        walletAddress: wallet,
        themeColor: "22c55e",
        hideMenu: "true",
        disableWalletAddressForm: "true",
    });

    return `${base}?${params.toString()}`;
}

// ─── Setup Guide (shown when no API key is configured) ───
function SetupGuide() {
    const [copied, setCopied] = useState(false);
    const envLine = 'NEXT_PUBLIC_TRANSAK_API_KEY=your-api-key-here';

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-black/60 border border-yellow-500/20 rounded-2xl p-8 backdrop-blur-xl">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-4">
                        <CreditCard size={28} className="text-yellow-400" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">Set Up Fiat On-Ramp</h2>
                    <p className="text-muted-foreground">One-time setup to enable credit card purchases directly on SHX</p>
                </div>

                <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-black shrink-0">1</div>
                        <div className="flex-1">
                            <h3 className="text-white font-bold mb-1">Create a free Transak account</h3>
                            <p className="text-sm text-muted-foreground mb-3">Takes 2 minutes. No payment required.</p>
                            <a
                                href="https://dashboard.transak.com/register"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm text-white font-bold transition-colors"
                            >
                                Open Transak Dashboard <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-black shrink-0">2</div>
                        <div className="flex-1">
                            <h3 className="text-white font-bold mb-1">Copy your API Key</h3>
                            <p className="text-sm text-muted-foreground">In the dashboard, go to <strong className="text-white">Developers</strong> and copy your API Key.</p>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-black shrink-0">3</div>
                        <div className="flex-1">
                            <h3 className="text-white font-bold mb-1">Add it to your environment</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Add this line to your <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">.env.local</code> file:
                            </p>
                            <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-xl p-3">
                                <code className="text-xs text-green-400 font-mono flex-1 break-all">{envLine}</code>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(envLine); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
                                >
                                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-muted-foreground" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-sm font-black shrink-0">4</div>
                        <div className="flex-1">
                            <h3 className="text-white font-bold mb-1">Restart & deploy</h3>
                            <p className="text-sm text-muted-foreground">Restart your dev server or redeploy. The Buy page will work instantly.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <p className="text-xs text-muted-foreground">
                        Transak handles KYC, compliance, and payment processing. SHX never sees card details.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ───
export default function BuyPage() {
    const { publicKey, connected } = useWallet();
    const [amount, setAmount] = useState(100);
    const [customAmount, setCustomAmount] = useState("");
    const [showWidget, setShowWidget] = useState(false);
    const [widgetLoading, setWidgetLoading] = useState(true);

    const hasApiKey = TRANSAK_API_KEY.length > 10;
    const effectiveAmount = customAmount ? parseFloat(customAmount) || 100 : amount;
    const walletAddr = publicKey?.toBase58() || "";
    const embedUrl = hasApiKey && connected ? buildTransakUrl(walletAddr, effectiveAmount, false) : "";

    return (
        <main className="min-h-screen bg-background relative overflow-hidden pb-20">
            {/* Background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-500/15 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

            {/* ─── Embedded Transak Widget Overlay ─── */}
            {showWidget && hasApiKey && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="relative w-full max-w-lg h-[700px] bg-black/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/80">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <CreditCard size={12} className="text-white" />
                                </div>
                                <span className="text-sm font-bold text-white">Buy SOL</span>
                                <span className="text-[10px] text-muted-foreground">• ${effectiveAmount} via Transak</span>
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
                                    <span className="text-sm text-muted-foreground">Loading Transak...</span>
                                </div>
                            </div>
                        )}
                        <iframe
                            src={embedUrl}
                            className="w-full h-[calc(100%-48px)] border-0"
                            onLoad={() => setWidgetLoading(false)}
                            title="Transak Buy SOL"
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
                        Buy SOL with{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                            your card.
                        </span>
                    </h1>
                    <p className="text-muted-foreground text-base max-w-xl mx-auto">
                        Purchase SOL directly to your wallet — right here on SHX. No redirects.
                    </p>
                </div>

                {/* If no API key, show setup guide */}
                {!hasApiKey ? (
                    <SetupGuide />
                ) : (
                    <>
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
                                    You&apos;ll receive approximately <strong className="text-white">{(effectiveAmount / 170).toFixed(2)} SOL</strong> at current prices
                                </p>
                            </div>

                            {/* Provider Info */}
                            <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                        <CreditCard size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-sm">Powered by Transak</div>
                                        <div className="text-[10px] text-muted-foreground">100+ countries • Visa, Mastercard, Apple Pay</div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {["Visa", "Mastercard", "Apple Pay", "Google Pay", "Bank Transfer", "Sepa"].map((m) => (
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
                                            onClick={() => { setWidgetLoading(true); setShowWidget(true); }}
                                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-xl font-black text-base transition-all hover:scale-[1.02] shadow-lg hover:shadow-xl"
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
                                <strong className="text-white">100% in-app.</strong> The checkout opens directly inside SHX Exchange. Transak handles KYC and payment processing. SOL lands in your connected wallet within minutes.
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
