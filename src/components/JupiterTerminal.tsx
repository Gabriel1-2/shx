"use client";

import { useEffect, useState, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2, Zap } from "lucide-react";
import { addPoints, addVolume, addFeesPaid } from "@/lib/points";
import { addReferralEarnings } from "@/lib/referrals";
import { saveSwapTransaction } from "@/lib/transactions";

// Jupiter Plugin script URL (latest v4)
const JUPITER_SCRIPT_SRC = "https://terminal.jup.ag/main-v4.js";

// Default mints
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// ──────────────────────────────────────────────────────────────
// REFERRAL CONFIG — This is how you earn money from every swap!
// ──────────────────────────────────────────────────────────────
// 1. Go to https://referral.jup.ag/ and create a referral account
//    with your Solana wallet. Copy the referral account public key.
// 2. Create referralTokenAccounts for each mint you want to collect
//    fees in (SOL, USDC, etc).
// 3. Paste your referral account public key below.
// 4. Set feeBps (50 = 0.50%, 100 = 1.00%, etc).
//
// Jupiter takes ~20% of the fee, you keep ~80%.
// ──────────────────────────────────────────────────────────────
const REFERRAL_ACCOUNT = "315sEtamwE8CvKJrARkBRW6kwMDxP8WRPnFnBY4CBA7r";
const PLATFORM_FEE_BPS = 50; // 0.50% — adjust as you wish

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

    // Initialize Jupiter when script loads or wallet changes
    useEffect(() => {
        if (!isLoaded || !window.Jupiter) return;

        const timer = setTimeout(() => {
            try {
                window.Jupiter.init({
                    displayMode: "integrated",
                    integratedTargetId: "jupiter-terminal",
                    endpoint: "https://mainnet.helius-rpc.com/?api-key=e36d269b-1bf1-4c2a-9efd-47d319ca4882",
                    passThroughWallet: wallet ? wallet.adapter : undefined,
                    defaultExplorer: "Solscan",
                    strictTokenList: false,

                    // ─── REFERRAL FEES ─────────────────────────────
                    // Uncomment below AFTER you create a valid referral
                    // account at https://referral.jup.ag/ and initialize
                    // token accounts for SOL, USDC, etc.
                    //
                    // Without proper setup, this causes "Error fetching route"
                    //
                    // platformFeeAndAccounts: {
                    //     referralAccount: REFERRAL_ACCOUNT,
                    //     feeBps: PLATFORM_FEE_BPS,
                    // },

                    formProps: {
                        fixedInputMint: false,
                        fixedOutputMint: false,
                        initialInputMint: SOL_MINT,
                        initialOutputMint: USDC_MINT,
                        initialSlippageBps: 50,
                    },

                    // ─── ANALYTICS CALLBACKS ──────────────────────
                    // These fire on every successful/failed swap so
                    // the dashboard, leaderboard, XP, referrals, and
                    // transaction history all stay up-to-date.
                    onSuccess: async ({ txid, swapResult, quoteResponseMeta }: any) => {
                        console.log("✅ Swap Successful!", txid);
                        setLastTx(txid);

                        if (publicKey) {
                            const walletAddr = publicKey.toString();

                            // Try to extract volume from the swap result
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

                                    // Rough USD estimate from quote amounts
                                    const inDecimals = inputMint === SOL_MINT ? 9 : 6;
                                    const outDecimals = outputMint === SOL_MINT ? 9 : 6;
                                    inputAmount = Number(quote.inAmount) / Math.pow(10, inDecimals);
                                    outputAmount = Number(quote.outAmount) / Math.pow(10, outDecimals);

                                    // If one side is USDC/USDT, use that as the USD value
                                    const STABLECOINS = [
                                        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
                                        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
                                    ];
                                    if (STABLECOINS.includes(inputMint)) {
                                        volumeUSD = inputAmount;
                                    } else if (STABLECOINS.includes(outputMint)) {
                                        volumeUSD = outputAmount;
                                    } else {
                                        // Rough fallback: assume input is SOL at ~$150
                                        volumeUSD = inputAmount * 150;
                                    }

                                    inputSymbol = inputMint === SOL_MINT ? "SOL" : inputMint.slice(0, 6);
                                    outputSymbol = outputMint === SOL_MINT ? "SOL" : outputMint.slice(0, 6);
                                }
                            } catch (e) {
                                console.warn("[Analytics] Could not parse swap result", e);
                                volumeUSD = 100; // Conservative fallback
                            }

                            const feeUSD = volumeUSD * (PLATFORM_FEE_BPS / 10000);
                            const xpEarned = Math.max(100, Math.floor(volumeUSD * 10));

                            // Fire all analytics in parallel
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

                            console.log(`[Analytics] +${xpEarned} XP, $${volumeUSD.toFixed(2)} vol, $${feeUSD.toFixed(2)} fee`);
                        }
                    },

                    onSwapError: ({ error }: any) => {
                        console.error("❌ Swap Error:", error);
                    },
                });
                setIsInitialized(true);
            } catch (e) {
                console.error("[Jupiter] Init failed:", e);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [isLoaded, wallet, publicKey]);

    return (
        <div className="w-full">
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

            {/* Connect Wallet CTA (only when not connected) */}
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
