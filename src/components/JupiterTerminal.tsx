"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
    Loader2,
    Zap,
    Sparkles,
    TrendingDown,
    Flame,
    Shield,
    Rocket,
    Gauge,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useSHXTier } from "@/hooks/useSHXTier";
import { isSHXBuy, FEE_TIERS } from "@/lib/feeTiers";
import { TierBadge } from "@/components/TierBadge";
import { SavingsReceipt } from "@/components/SavingsReceipt";
import { SHULEVITZ_MINT } from "@/lib/constants";
import { useStore } from "@/store";
import {
    recordTradeSavings,
    type SavingsSnapshot,
} from "@/lib/tradeSavings";

// Jupiter Plugin script URL (v1 — confirmed by Jupiter dev team)
const JUPITER_SCRIPT_SRC = "https://plugin.jup.ag/plugin-v1.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const REFERRAL_ACCOUNT = "9rvZ5CC86oFWgwej21DMPR83LSMBoDehrNe6v6V7AAeg";

/** Ape size chips — raw lamports for ExactIn SOL sells */
const APE_SIZES: { label: string; sol: number; lamports: string }[] = [
    { label: "0.1", sol: 0.1, lamports: "100000000" },
    { label: "0.25", sol: 0.25, lamports: "250000000" },
    { label: "0.5", sol: 0.5, lamports: "500000000" },
    { label: "1", sol: 1, lamports: "1000000000" },
    { label: "2", sol: 2, lamports: "2000000000" },
];

declare global {
    interface Window {
        Jupiter: any;
    }
}

export default function JupiterTerminal() {
    const { wallet, publicKey, connected } = useWallet();
    const { setVisible } = useWalletModal();
    const preferredOutputMint = useStore((s) => s.preferredOutputMint);
    const setPreferredOutputMint = useStore((s) => s.setPreferredOutputMint);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [lastTx, setLastTx] = useState<string | null>(null);
    const [isBuyingSHX, setIsBuyingSHX] = useState(false);
    const [apeMode, setApeMode] = useState(false);
    /** Turbo: higher slippage + aggressive re-init for faster land UX */
    const [turboLand, setTurboLand] = useState(false);
    const [apeSizeLamports, setApeSizeLamports] = useState<string | null>(null);
    const [urlOutput, setUrlOutput] = useState<string | null>(null);
    const [savingsSnap, setSavingsSnap] = useState<SavingsSnapshot | null>(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastInitKey = useRef<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const sp = new URLSearchParams(window.location.search);
        const out =
            sp.get("output") ||
            sp.get("outputMint") ||
            (sp.get("focus") === "shx" ? SHULEVITZ_MINT : null) ||
            sp.get("mint");
        if (out) setUrlOutput(out);
        // Auto-arm ape from deep link
        if (sp.get("ape") === "1" || sp.get("mode") === "ape") {
            setApeMode(true);
            setTurboLand(true);
        }
        const size = sp.get("size");
        if (size) {
            const match = APE_SIZES.find((s) => s.label === size || String(s.sol) === size);
            if (match) setApeSizeLamports(match.lamports);
        }
    }, []);

    const initialOutput = preferredOutputMint || urlOutput || USDC_MINT;

    const currentOutputMint = useRef<string>(USDC_MINT);
    const apeModeRef = useRef(false);
    const turboRef = useRef(false);
    apeModeRef.current = apeMode;
    turboRef.current = turboLand;

    useEffect(() => {
        if (urlOutput) {
            currentOutputMint.current = urlOutput;
            setIsBuyingSHX(isSHXBuy(urlOutput));
            setPreferredOutputMint(urlOutput);
            lastInitKey.current = null;
        }
    }, [urlOutput, setPreferredOutputMint]);

    useEffect(() => {
        if (preferredOutputMint) {
            currentOutputMint.current = preferredOutputMint;
            setIsBuyingSHX(isSHXBuy(preferredOutputMint));
            lastInitKey.current = null;
        }
    }, [preferredOutputMint]);

    const publicKeyRef = useRef(publicKey);
    publicKeyRef.current = publicKey;
    const feeBpsRef = useRef(0);
    const initJupiterRef = useRef<((fee: number) => void) | null>(null);
    const tierLabelRef = useRef("Base");

    const tierData = useSHXTier();
    feeBpsRef.current = tierData.feeBps;
    tierLabelRef.current = isBuyingSHX ? "SHX Buy (0%)" : tierData.tier.label;

    useEffect(() => {
        if (window.Jupiter) {
            setIsLoaded(true);
            return;
        }

        const existingScript = document.querySelector(
            `script[src="${JUPITER_SCRIPT_SRC}"]`
        );
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

    const slippageForMode = (ape: boolean, turbo: boolean) => {
        if (turbo && ape) return 150; // 1.5%
        if (ape) return 100; // 1%
        if (turbo) return 75; // 0.75%
        return 50; // 0.5%
    };

    const initJupiter = useCallback(
        (feeBps: number, ape = apeModeRef.current, turbo = turboRef.current) => {
            if (!isLoaded || !window.Jupiter) return;

            try {
                const slip = slippageForMode(ape, turbo);
                const formProps: Record<string, unknown> = {
                    fixedInputMint: false,
                    fixedOutputMint: false,
                    initialInputMint: SOL_MINT,
                    initialOutputMint:
                        currentOutputMint.current || initialOutput || USDC_MINT,
                    initialSlippageBps: slip,
                };

                // Size preset → prefill ExactIn amount (lamports)
                if (apeSizeLamports) {
                    formProps.initialAmount = apeSizeLamports;
                }

                if (feeBps > 0) {
                    formProps.referralAccount = REFERRAL_ACCOUNT;
                    formProps.referralFee = feeBps;
                }

                window.Jupiter.init({
                    displayMode: "integrated",
                    integratedTargetId: "jupiter-terminal",
                    // Dedicated RPC when configured — fewer timeouts, faster accounts
                    endpoint:
                        process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
                        "https://api.mainnet-beta.solana.com",
                    passThroughWallet: wallet ? wallet.adapter : undefined,
                    defaultExplorer: "Solscan",
                    strictTokenList: false,
                    formProps,

                    onFormUpdate: (form: any) => {
                        if (form?.outputMint) {
                            const newOutputMint = form.outputMint;
                            const wasBuyingSHX = isSHXBuy(currentOutputMint.current);
                            const nowBuyingSHX = isSHXBuy(newOutputMint);

                            currentOutputMint.current = newOutputMint;

                            if (wasBuyingSHX !== nowBuyingSHX) {
                                setIsBuyingSHX(nowBuyingSHX);
                                const newFee = nowBuyingSHX ? 0 : tierData.feeBps;
                                setTimeout(() => {
                                    lastInitKey.current = null;
                                    if (initJupiterRef.current)
                                        initJupiterRef.current(newFee);
                                }, 200);
                            }
                        }
                    },

                    onSuccess: async (params: { txid: string; swapResult?: unknown }) => {
                        const { txid } = params;
                        console.log("✅ Swap Successful!", txid);
                        setLastTx(txid);

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
                        if (!currentPubKey) return;

                        const walletAddr = currentPubKey.toString();
                        const feeAtTrade = isSHXBuy(currentOutputMint.current)
                            ? 0
                            : feeBpsRef.current;
                        const tierAtTrade = tierLabelRef.current;

                        try {
                            const trackRes = await fetch("/api/analytics/track", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ txid, walletAddr }),
                            });

                            const trackData = await trackRes.json();
                            if (trackData.success) {
                                const volumeUSD = Number(trackData.volumeUSD || 0);
                                const snap = recordTradeSavings({
                                    volumeUsd: volumeUSD,
                                    effectiveFeeBps: feeAtTrade,
                                    tierLabel: tierAtTrade,
                                });
                                setSavingsSnap(snap);
                                setShowReceipt(true);

                                window.dispatchEvent(new Event("shx-swap-success"));
                                window.dispatchEvent(
                                    new CustomEvent("shx-trade-toast", {
                                        detail: {
                                            volumeUSD,
                                            points: trackData.points,
                                            txid,
                                            isNewTrader: trackData.isNewTrader,
                                            savedUsd: snap.lastSavedUsd,
                                            lifetimeSavedUsd: snap.lifetimeSavedUsd,
                                        },
                                    })
                                );
                            } else {
                                console.error("[SECURE ANALYTICS] Failed:", trackData.error);
                            }
                        } catch (err) {
                            console.error("[SECURE ANALYTICS] Error:", err);
                        }
                    },

                    onSwapError: ({ error }: { error: unknown }) => {
                        console.error("❌ Swap Error:", error);
                    },
                });
                lastInitKey.current = `${feeBps}:${ape ? "ape" : "std"}:${turbo ? "turbo" : "norm"}:${apeSizeLamports || "nosize"}`;
                setIsInitialized(true);
            } catch (e) {
                console.error("[Jupiter] Init failed:", e);
            }
        },
        [isLoaded, wallet, tierData.feeBps, initialOutput, apeSizeLamports]
    );

    useEffect(() => {
        initJupiterRef.current = initJupiter;
    }, [initJupiter]);

    useEffect(() => {
        if (!isLoaded || !window.Jupiter) return;

        const effectiveFeeBps = isBuyingSHX ? 0 : tierData.feeBps;
        const out = currentOutputMint.current || initialOutput;
        const key = `${effectiveFeeBps}:${apeMode ? "ape" : "std"}:${turboLand ? "turbo" : "norm"}:${out}:${apeSizeLamports || "nosize"}`;
        if (lastInitKey.current === key && isInitialized) return;

        // Faster re-init in turbo/ape
        const delay = apeMode || turboLand ? 80 : 200;
        const timer = setTimeout(() => {
            initJupiter(effectiveFeeBps, apeMode, turboLand);
        }, delay);

        return () => clearTimeout(timer);
    }, [
        isLoaded,
        wallet,
        publicKey,
        tierData.feeBps,
        isBuyingSHX,
        apeMode,
        turboLand,
        apeSizeLamports,
        initJupiter,
        isInitialized,
        initialOutput,
        preferredOutputMint,
    ]);

    const baseFee = FEE_TIERS[0].feePercent;
    const userFee = isBuyingSHX ? 0 : tierData.feePercent;
    const saving = baseFee - userFee;
    const hasSavings = connected && saving > 0;

    const selectSize = (lamports: string | null) => {
        setApeSizeLamports(lamports);
        if (lamports) {
            setApeMode(true);
        }
        lastInitKey.current = null;
    };

    return (
        <div className="w-full">
            {connected && (
                <div className="mb-3 space-y-2">
                    <div className="flex items-center justify-between px-3 md:px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-xl">
                        <div className="flex items-center gap-2">
                            <TierBadge tier={tierData.tier} size="sm" />
                            <span className="text-[11px] md:text-xs text-muted-foreground">
                                Fee:{" "}
                                <span
                                    className={`font-bold ${
                                        isBuyingSHX ? "text-green-400" : "text-white"
                                    }`}
                                >
                                    {isBuyingSHX ? "0%" : `${tierData.feePercent}%`}
                                </span>
                            </span>
                        </div>
                        {isBuyingSHX ? (
                            <div className="flex items-center gap-1 text-green-400">
                                <Sparkles size={12} />
                                <span className="text-[10px] md:text-[11px] font-bold">
                                    0% — Buying SHX!
                                </span>
                            </div>
                        ) : hasSavings ? (
                            <div className="flex items-center gap-1 text-green-400">
                                <TrendingDown size={12} />
                                <span className="text-[10px] md:text-[11px] font-bold">
                                    Saving {saving.toFixed(2)}%
                                </span>
                            </div>
                        ) : null}
                    </div>

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
            <div
                className={`flex items-center justify-between rounded-t-2xl px-4 md:px-5 py-3 md:py-3.5 border border-b-0 backdrop-blur-xl ${
                    apeMode
                        ? "bg-gradient-to-r from-orange-500/20 via-black/70 to-red-500/15 border-orange-500/30"
                        : "bg-black/60 border-white/10"
                }`}
            >
                <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center">
                        <div
                            className={`absolute w-5 h-5 blur-sm opacity-50 animate-pulse rounded-full ${
                                apeMode ? "bg-orange-500" : "bg-green-500"
                            }`}
                        />
                        {apeMode ? (
                            <Flame className="relative text-orange-400 z-10" size={16} />
                        ) : (
                            <Zap className="relative text-green-400 z-10" size={16} />
                        )}
                    </div>
                    <span
                        className={`font-bold text-sm tracking-wide ${
                            apeMode
                                ? "text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400"
                                : "text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500"
                        }`}
                    >
                        {apeMode ? "APE MODE" : "JUPITER ULTRA"}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => {
                            setTurboLand((v) => !v);
                            lastInitKey.current = null;
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${
                            turboLand
                                ? "bg-cyan-500/25 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                                : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                        }`}
                        title="Higher slippage + snappier terminal re-init for congested blocks"
                    >
                        <Rocket size={11} />
                        Turbo
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setApeMode((v) => !v);
                            lastInitKey.current = null;
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${
                            apeMode
                                ? "bg-orange-500/25 border-orange-500/50 text-orange-300 shadow-[0_0_16px_rgba(249,115,22,0.35)]"
                                : "bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                        }`}
                        title="1%+ slippage for sniping launches"
                    >
                        <Flame size={11} />
                        Ape
                    </button>
                    {lastTx && (
                        <a
                            href={`https://solscan.io/tx/${lastTx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-green-400 hover:text-green-300 transition-colors font-mono hidden sm:inline"
                        >
                            ✅ {lastTx.slice(0, 8)}...
                        </a>
                    )}
                    <div
                        className={`h-2 w-2 rounded-full animate-pulse ${
                            apeMode ? "bg-orange-500" : "bg-green-500"
                        }`}
                    />
                </div>
            </div>

            {/* Ape / turbo strip + size presets */}
            <div
                className={`px-3 py-2 border-x space-y-2 ${
                    apeMode || turboLand
                        ? "bg-orange-500/10 border-orange-500/20"
                        : "bg-black/40 border-white/10"
                }`}
            >
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                    {(apeMode || turboLand) && (
                        <>
                            <Shield size={10} className="text-orange-300" />
                            <span className="text-orange-300">
                                Slip {slippageForMode(apeMode, turboLand) / 100}%
                                {turboLand ? " · turbo land" : ""} · size carefully
                            </span>
                            <span className="text-white/20">·</span>
                        </>
                    )}
                    <Gauge size={10} />
                    <span>Quick size (SOL → out)</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {APE_SIZES.map((s) => {
                        const on = apeSizeLamports === s.lamports;
                        return (
                            <button
                                key={s.lamports}
                                type="button"
                                onClick={() =>
                                    selectSize(on ? null : s.lamports)
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                    on
                                        ? "bg-primary/25 border-primary text-primary shadow-[0_0_12px_rgba(34,197,94,0.25)]"
                                        : "bg-white/5 border-white/10 text-white hover:border-white/25"
                                }`}
                            >
                                {s.label} SOL
                            </button>
                        );
                    })}
                    {apeSizeLamports && (
                        <button
                            type="button"
                            onClick={() => selectSize(null)}
                            className="px-2 py-1 rounded-lg text-[10px] text-muted-foreground hover:text-white"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

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

            {showReceipt && (
                <SavingsReceipt
                    snapshot={savingsSnap}
                    txid={lastTx}
                    onClose={() => setShowReceipt(false)}
                />
            )}

            {!connected && (
                <button
                    onClick={() => setVisible(true)}
                    className="mt-4 w-full rounded-xl py-3.5 font-bold text-sm bg-gradient-to-r from-primary to-lime-400 text-black hover:opacity-90 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                >
                    Connect Wallet to Swap
                </button>
            )}

            <div className="flex items-center justify-center gap-4 md:gap-6 mt-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[9px] md:text-[10px] uppercase tracking-wider">
                        Operational
                    </span>
                </div>
                <div className="h-3 w-px bg-white/10" />
                <span className="text-[9px] md:text-[10px] uppercase tracking-wider">
                    Best Routes
                </span>
                <div className="h-3 w-px bg-white/10" />
                <span className="text-[9px] md:text-[10px] uppercase tracking-wider">
                    Non-Custodial
                </span>
                <div className="h-3 w-px bg-white/10 hidden sm:block" />
                <a
                    href="/api/mcp"
                    className="text-[9px] md:text-[10px] uppercase tracking-wider hover:text-primary hidden sm:inline"
                >
                    Agent MCP
                </a>
            </div>

            <style jsx global>{`
                #jupiter-terminal .jupiter-terminal-container,
                #jupiter-terminal [class*="bg-jupiter"],
                #jupiter-terminal form {
                    background: #0a0a0a !important;
                }
            `}</style>
        </div>
    );
}
