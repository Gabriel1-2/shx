"use client";

import { useEffect, useState, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2, Zap, Sparkles, TrendingDown } from "lucide-react";
import { addPoints, addVolume, addFeesPaid } from "@/lib/points";
import { addReferralEarnings } from "@/lib/referrals";
import { saveSwapTransaction } from "@/lib/transactions";
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
    const containerRef = useRef<HTMLDivElement>(null);
    const lastInitFeeBps = useRef<number | null>(null);

    // SHX Tier — determines the dynamic fee
    const tierData = useSHXTier();

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

    // Initialize Jupiter when script loads, wallet changes, or fee tier changes
    useEffect(() => {
        if (!isLoaded || !window.Jupiter) return;

        // Only re-init if the fee actually changed
        const effectiveFeeBps = tierData.feeBps;
        if (lastInitFeeBps.current === effectiveFeeBps && isInitialized) return;

        const timer = setTimeout(() => {
            try {
                // Build formProps with dynamic fee
                const formProps: any = {
                    fixedInputMint: false,
                    fixedOutputMint: false,
                    initialInputMint: SOL_MINT,
                    initialOutputMint: USDC_MINT,
                    initialSlippageBps: 50,
                };

                // Add referral fee (tier-based)
                if (effectiveFeeBps > 0) {
                    formProps.referralAccount = REFERRAL_ACCOUNT;
                    formProps.referralFee = effectiveFeeBps;
                }

                window.Jupiter.init({
                    displayMode: "integrated",
                    integratedTargetId: "jupiter-terminal",
                    endpoint: "https://mainnet.helius-rpc.com/?api-key=e36d269b-1bf1-4c2a-9efd-47d319ca4882",
                    passThroughWallet: wallet ? wallet.adapter : undefined,
                    defaultExplorer: "Solscan",
                    strictTokenList: false,
                    formProps,

                    // ─── ANALYTICS CALLBACKS ──────────────────────
                    onSuccess: async ({ txid, swapResult, quoteResponseMeta }: any) => {
                        console.log("✅ Swap Successful!", txid);
                        setLastTx(txid);

                        if (publicKey) {
                            const walletAddr = publicKey.toString();
                            let volumeUSD = 0;
                            let inputSymbol = "Unknown";
                            let outputSymbol = "Unknown";
                            let inputAmount = 0;
                            let outputAmount = 0;
                            let inputMint = "";
                            let outputMint = "";

                            try {
                                if (quoteResponseMeta?.quoteResponse) {
                                    const quote = quoteResponseMeta.quoteResponse;
                                    inputMint = quote.inputMint || "";
                                    outputMint = quote.outputMint || "";

                                    const inDecimals = inputMint === SOL_MINT ? 9 : 6;
                                    const outDecimals = outputMint === SOL_MINT ? 9 : 6;
                                    inputAmount = Number(quote.inAmount) / Math.pow(10, inDecimals);
                                    outputAmount = Number(quote.outAmount) / Math.pow(10, outDecimals);

                                    const STABLECOINS = [
                                        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                                        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                                    ];
                                    if (STABLECOINS.includes(inputMint)) {
                                        volumeUSD = inputAmount;
                                    } else if (STABLECOINS.includes(outputMint)) {
                                        volumeUSD = outputAmount;
                                    } else {
                                        volumeUSD = inputAmount * 150;
                                    }

                                    inputSymbol = inputMint === SOL_MINT ? "SOL" : inputMint.slice(0, 6);
                                    outputSymbol = outputMint === SOL_MINT ? "SOL" : outputMint.slice(0, 6);
                                }
                            } catch (e) {
                                console.warn("[Analytics] Could not parse swap result", e);
                                volumeUSD = 100;
                            }

                            // Use effective fee for this trade
                            const actualFeePct = isSHXBuy(outputMint) ? 0 : effectiveFeeBps / 10000;
                            const feeUSD = volumeUSD * actualFeePct;
                            const xpEarned = Math.max(100, Math.floor(volumeUSD * 10));

                            await Promise.all([
                                addPoints(walletAddr, xpEarned),
                                addVolume(walletAddr, volumeUSD),
                                addFeesPaid(walletAddr, feeUSD),
                                addReferralEarnings(walletAddr, feeUSD, volumeUSD),
                                saveSwapTransaction({
                                    wallet: walletAddr,
                                    inputToken: inputSymbol,
                                    inputAmount,
                                    inputMint,
                                    outputToken: outputSymbol,
                                    outputAmount,
                                    outputMint,
                                    volumeUSD,
                                    feePaid: feeUSD,
                                    txSignature: txid,
                                }),
                            ]);

                            console.log(`[Analytics] +${xpEarned} XP, $${volumeUSD.toFixed(2)} vol, fee: ${actualFeePct * 100}%`);
                        }
                    },

                    onSwapError: ({ error }: any) => {
                        console.error("❌ Swap Error:", error);
                    },
                });
                lastInitFeeBps.current = effectiveFeeBps;
                setIsInitialized(true);
            } catch (e) {
                console.error("[Jupiter] Init failed:", e);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [isLoaded, wallet, publicKey, tierData.feeBps]);

    // Compute savings message
    const baseFee = FEE_TIERS[0].feePercent;
    const userFee = tierData.feePercent;
    const saving = baseFee - userFee;
    const hasSavings = connected && saving > 0;

    return (
        <div className="w-full">
            {/* Fee Savings Banner */}
            {connected && (
                <div className="mb-3 space-y-2">
                    {/* Tier + Fee Info */}
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-xl">
                        <div className="flex items-center gap-2">
                            <TierBadge tier={tierData.tier} size="sm" />
                            <span className="text-xs text-muted-foreground">
                                Your fee: <span className="text-white font-bold">{userFee}%</span>
                            </span>
                        </div>
                        {hasSavings && (
                            <div className="flex items-center gap-1 text-green-400">
                                <TrendingDown size={12} />
                                <span className="text-[11px] font-bold">Saving {saving.toFixed(2)}%</span>
                            </div>
                        )}
                    </div>

                    {/* 0% SHX Buy Callout */}
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                        <Sparkles size={14} className="text-green-400" />
                        <span className="text-[11px] text-green-400 font-medium">
                            0% platform fee when buying SHX!
                        </span>
                    </div>
                </div>
            )}

            {/* Terminal Header */}
            <div className="flex items-center justify-between rounded-t-2xl bg-black/60 px-5 py-3.5 border border-b-0 border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-5 h-5 bg-green-500 blur-sm opacity-50 animate-pulse rounded-full"></div>
                        <Zap className="relative text-green-400 z-10" size={16} />
                    </div>
                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 text-sm tracking-wide">
                        JUPITER ULTRA
                    </span>
                </div>
                <div className="flex items-center gap-2">
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
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                        Powered by Jupiter
                    </span>
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </div>
            </div>

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
            <div className="flex items-center justify-center gap-6 mt-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span className="text-[10px] uppercase tracking-wider">Operational</span>
                </div>
                <div className="h-3 w-px bg-white/10"></div>
                <span className="text-[10px] uppercase tracking-wider">Best Routes</span>
                <div className="h-3 w-px bg-white/10"></div>
                <span className="text-[10px] uppercase tracking-wider">Non-Custodial</span>
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
