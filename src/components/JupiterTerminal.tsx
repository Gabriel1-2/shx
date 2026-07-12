"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2, Zap, Sparkles, TrendingDown, Flame, Shield } from "lucide-react";
import confetti from "canvas-confetti";
import { useSHXTier } from "@/hooks/useSHXTier";
import { isSHXBuy, FEE_TIERS } from "@/lib/feeTiers";
import { TierBadge } from "@/components/TierBadge";
import { SHULEVITZ_MINT } from "@/lib/constants";

// Jupiter Plugin script URL (v1 — confirmed by Jupiter dev team)
const JUPITER_SCRIPT_SRC = "https://plugin.jup.ag/plugin-v1.js";

// Default mints
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Referral account for fee collection
const REFERRAL_ACCOUNT = "9rvZ5CC86oFWgwej21DMPR83LSMBoDehrNe6v6V7AAeg";

declare global {
    interface Window {
        Jupiter: any;
    }
}

export default function JupiterTerminal() {
    const { wallet, publicKey, connected } = useWallet();
    const { setVisible } = useWalletModal();
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [lastTx, setLastTx] = useState<string | null>(null);
    const [isBuyingSHX, setIsBuyingSHX] = useState(false);
    const [apeMode, setApeMode] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastInitKey = useRef<string | null>(null);
    const currentOutputMint = useRef<string>(USDC_MINT);
    const apeModeRef = useRef(false);
    apeModeRef.current = apeMode;

    // ─── REFS to avoid stale closures in Jupiter callbacks ───
    const publicKeyRef = useRef(publicKey);
    publicKeyRef.current = publicKey;
    const feeBpsRef = useRef(0);
    const initJupiterRef = useRef<((fee: number) => void) | null>(null);

    // SHX Tier — determines the dynamic fee
    const tierData = useSHXTier();
    feeBpsRef.current = tierData.feeBps;

    // Load Jupiter Plugin script
    useEffect(() => {
        if (window.Jupiter) {
            setIsLoaded(true);
            return;
        }

        const existingScript = document.querySelector(`script[src="${JUPITER_SCRIPT_SRC}"]`);
        if (existingScript) {
            existingScript.addEventListener("load", () => setIsLoaded(true));
            return;
        }

        const script = document.createElement("script");
        script.src = JUPITER_SCRIPT_SRC;
        script.async = true;
        script.onload = () => setIsLoaded(true);
        script.onerror = () => console.error("[Jupiter] Plugin script failed to load");
        document.head.appendChild(script);
    }, []);

    // Init Jupiter with a specific fee (+ optional Ape Mode slippage)
    const initJupiter = useCallback((feeBps: number, ape = apeModeRef.current) => {
        if (!isLoaded || !window.Jupiter) return;

        try {
            const formProps: any = {
                fixedInputMint: false,
                fixedOutputMint: false,
                initialInputMint: SOL_MINT,
                initialOutputMint: currentOutputMint.current || USDC_MINT,
                // Ape Mode: 1% slippage for launches; default 0.5%
                initialSlippageBps: ape ? 100 : 50,
            };

            // Only add referral fee if > 0 (SHX buys = 0% = no referral)
            if (feeBps > 0) {
                formProps.referralAccount = REFERRAL_ACCOUNT;
                formProps.referralFee = feeBps;
            }

            window.Jupiter.init({
                displayMode: "integrated",
                integratedTargetId: "jupiter-terminal",
                endpoint: process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com",
                passThroughWallet: wallet ? wallet.adapter : undefined,
                defaultExplorer: "Solscan",
                strictTokenList: false,
                formProps,

                // ─── DETECT OUTPUT TOKEN CHANGES ──────────────
                onFormUpdate: (form: any) => {
                    if (form?.outputMint) {
                        const newOutputMint = form.outputMint;
                        const wasBuyingSHX = isSHXBuy(currentOutputMint.current);
                        const nowBuyingSHX = isSHXBuy(newOutputMint);

                        currentOutputMint.current = newOutputMint;

                        // If SHX buy state changed, re-init with correct fee
                        if (wasBuyingSHX !== nowBuyingSHX) {
                            setIsBuyingSHX(nowBuyingSHX);
                            const newFee = nowBuyingSHX ? 0 : tierData.feeBps;
                            console.log(`[Jupiter] Output changed → ${nowBuyingSHX ? 'SHX (0% fee)' : `other (${newFee} bps)`}`);

                            // Debounce re-init to avoid rapid re-renders
                            setTimeout(() => {
                                lastInitKey.current = null; // Force re-init
                                if (initJupiterRef.current) initJupiterRef.current(newFee);
                            }, 300);
                        }
                    }
                },

                // ─── ANALYTICS CALLBACKS ──────────────────────
                onSuccess: async (params: { txid: string; swapResult?: unknown }) => {
                    const { txid } = params;
                    console.log("✅ Swap Successful!", txid);
                    setLastTx(txid);

                    // Elite celebration
                    try {
                        confetti({
                            particleCount: apeModeRef.current ? 120 : 60,
                            spread: apeModeRef.current ? 80 : 55,
                            origin: { y: 0.65 },
                            colors: ["#22c55e", "#a3e635", "#ffffff", "#fbbf24"],
                        });
                    } catch {
                        /* ignore */
                    }

                    const currentPubKey = publicKeyRef.current;
                    if (!currentPubKey) {
                        console.warn("[Analytics] No wallet connected (publicKeyRef is null), skipping.");
                        return;
                    }

                    const walletAddr = currentPubKey.toString();

                    // ─── SEND TO SECURE BACKEND ───
                    try {
                        const trackRes = await fetch("/api/analytics/track", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                txid,
                                walletAddr,
                            })
                        });

                        const trackData = await trackRes.json();
                        if (trackData.success) {
                            console.log(`[SECURE ANALYTICS] Success: Recorded $${trackData.volumeUSD} volume, ${trackData.points} points`);
                            window.dispatchEvent(new Event("shx-swap-success"));
                            window.dispatchEvent(
                                new CustomEvent("shx-trade-toast", {
                                    detail: {
                                        volumeUSD: trackData.volumeUSD,
                                        points: trackData.points,
                                        txid,
                                        isNewTrader: trackData.isNewTrader,
                                    },
                                })
                            );
                        } else {
                            console.error("[SECURE ANALYTICS] Failed:", trackData.error);
                        }
                    } catch (err) {
                        console.error("[SECURE ANALYTICS] Error calling backend:", err);
                    }
                },

                onSwapError: ({ error }: { error: unknown }) => {
                    console.error("❌ Swap Error:", error);
                },
            });
            lastInitKey.current = `${feeBps}:${ape ? "ape" : "std"}`;
            setIsInitialized(true);
        } catch (e) {
            console.error("[Jupiter] Init failed:", e);
        }
    }, [isLoaded, wallet, publicKey, tierData.feeBps]);
    
    useEffect(() => {
        initJupiterRef.current = initJupiter;
    }, [initJupiter]);

    // Initialize Jupiter when script loads, wallet, fee tier, or Ape Mode changes
    useEffect(() => {
        if (!isLoaded || !window.Jupiter) return;

        const effectiveFeeBps = isBuyingSHX ? 0 : tierData.feeBps;
        const key = `${effectiveFeeBps}:${apeMode ? "ape" : "std"}`;
        if (lastInitKey.current === key && isInitialized) return;

        const timer = setTimeout(() => {
            initJupiter(effectiveFeeBps, apeMode);
        }, 200);

        return () => clearTimeout(timer);
    }, [isLoaded, wallet, publicKey, tierData.feeBps, isBuyingSHX, apeMode, initJupiter, isInitialized]);

    // Compute savings message
    const baseFee = FEE_TIERS[0].feePercent;
    const userFee = isBuyingSHX ? 0 : tierData.feePercent;
    const saving = baseFee - userFee;
    const hasSavings = connected && saving > 0;

    return (
        <div className="w-full">
            {/* Fee Savings Banner */}
            {connected && (
                <div className="mb-3 space-y-2">
                    {/* Tier + Fee Info */}
                    <div className="flex items-center justify-between px-3 md:px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-xl">
                        <div className="flex items-center gap-2">
                            <TierBadge tier={tierData.tier} size="sm" />
                            <span className="text-[11px] md:text-xs text-muted-foreground">
                                Fee: <span className={`font-bold ${isBuyingSHX ? 'text-green-400' : 'text-white'}`}>
                                    {isBuyingSHX ? '0%' : `${tierData.feePercent}%`}
                                </span>
                            </span>
                        </div>
                        {isBuyingSHX ? (
                            <div className="flex items-center gap-1 text-green-400">
                                <Sparkles size={12} />
                                <span className="text-[10px] md:text-[11px] font-bold">0% — Buying SHX!</span>
                            </div>
                        ) : hasSavings ? (
                            <div className="flex items-center gap-1 text-green-400">
                                <TrendingDown size={12} />
                                <span className="text-[10px] md:text-[11px] font-bold">Saving {saving.toFixed(2)}%</span>
                            </div>
                        ) : null}
                    </div>

                    {/* 0% SHX Buy Callout (only show when NOT already buying SHX) */}
                    {!isBuyingSHX && (
                        <div className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                            <Sparkles size={14} className="text-green-400 shrink-0" />
                            <span className="text-[10px] md:text-[11px] text-green-400 font-medium">
                                Switch output to SHX for 0% platform fee!
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Terminal Header */}
            <div className={`flex items-center justify-between rounded-t-2xl px-4 md:px-5 py-3 md:py-3.5 border border-b-0 backdrop-blur-xl ${
                apeMode
                    ? "bg-gradient-to-r from-orange-500/20 via-black/70 to-red-500/15 border-orange-500/30"
                    : "bg-black/60 border-white/10"
            }`}>
                <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center">
                        <div className={`absolute w-5 h-5 blur-sm opacity-50 animate-pulse rounded-full ${apeMode ? "bg-orange-500" : "bg-green-500"}`}></div>
                        {apeMode ? (
                            <Flame className="relative text-orange-400 z-10" size={16} />
                        ) : (
                            <Zap className="relative text-green-400 z-10" size={16} />
                        )}
                    </div>
                    <span className={`font-bold text-sm tracking-wide ${
                        apeMode
                            ? "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400"
                            : "text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500"
                    }`}>
                        {apeMode ? "APE MODE" : "JUPITER ULTRA"}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setApeMode((v) => !v)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${
                            apeMode
                                ? "bg-orange-500/25 border-orange-500/50 text-orange-300 shadow-[0_0_16px_rgba(249,115,22,0.35)]"
                                : "bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                        }`}
                        title="1% slippage for sniping launches"
                    >
                        <Flame size={11} />
                        Ape
                    </button>
                    {lastTx && (
                        <a
                            href={`https://solscan.io/tx/${lastTx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-green-400 hover:text-green-300 transition-colors font-mono"
                        >
                            ✅ {lastTx.slice(0, 8)}...
                        </a>
                    )}
                    <div className={`h-2 w-2 rounded-full animate-pulse ${apeMode ? "bg-orange-500" : "bg-green-500"}`} />
                </div>
            </div>
            {apeMode && (
                <div className="px-3 py-1.5 bg-orange-500/10 border-x border-orange-500/20 text-[10px] text-orange-300 flex items-center gap-1.5">
                    <Shield size={10} />
                    1% slippage armed · best for launches &amp; thin books · size carefully
                </div>
            )}

            {/* Jupiter Terminal Container */}
            <div
                ref={containerRef}
                className="rounded-b-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden shadow-2xl shadow-black/50"
            >
                <div
                    id="jupiter-terminal"
                    className="min-h-[440px] w-full flex items-center justify-center"
                >
                    {!isLoaded && (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground py-20">
                            <Loader2 className="animate-spin text-primary" size={28} />
                            <span className="text-sm font-medium">Loading Jupiter...</span>
                        </div>
                    )}
                    {isLoaded && !isInitialized && (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground py-20">
                            <Loader2 className="animate-spin text-primary" size={28} />
                            <span className="text-sm font-medium">Initializing Terminal...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Connect Wallet CTA */}
            {!connected && (
                <button
                    onClick={() => setVisible(true)}
                    className="mt-4 w-full rounded-xl py-3.5 font-bold text-sm bg-gradient-to-r from-primary to-lime-400 text-black hover:opacity-90 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                >
                    Connect Wallet to Swap
                </button>
            )}

            {/* Trust Badges */}
            <div className="flex items-center justify-center gap-4 md:gap-6 mt-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span className="text-[9px] md:text-[10px] uppercase tracking-wider">Operational</span>
                </div>
                <div className="h-3 w-px bg-white/10"></div>
                <span className="text-[9px] md:text-[10px] uppercase tracking-wider">Best Routes</span>
                <div className="h-3 w-px bg-white/10"></div>
                <span className="text-[9px] md:text-[10px] uppercase tracking-wider">Non-Custodial</span>
            </div>

            {/* Jupiter widget style overrides */}
            <style jsx global>{`
                #jupiter-terminal .jupiter-terminal-container,
                #jupiter-terminal [class*="bg-jupiter"],
                #jupiter-terminal form {
                    background: #0A0A0A !important;
                }
            `}</style>
        </div>
    );
}
