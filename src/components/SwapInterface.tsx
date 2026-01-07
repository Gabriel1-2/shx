"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { addPoints, addVolume, addFeesPaid } from "@/lib/points";
import { calculateFeeBps, getCurrentTier } from "@/lib/feeTiers";
import { getShulevitzHoldingsUSD, clearBalanceCache } from "@/lib/tokenBalance";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

// Jupiter Terminal config
const JUPITER_SCRIPT_SRC = "https://terminal.jup.ag/main-v2.js";
const SHULEVITZ_MINT = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";

declare global {
    interface Window {
        Jupiter: any;
    }
}

export function SwapInterface() {
    const { publicKey, wallet } = useWallet();
    const [isLoaded, setIsLoaded] = useState(false);
    const [apeMode, setApeMode] = useState(false);
    const [buyShulevitzMode, setBuyShulevitzMode] = useState(false);

    // Fee tier state
    const [holdingsUSD, setHoldingsUSD] = useState(0);
    const [currentFeeBps, setCurrentFeeBps] = useState(50); // Default 0.5%
    const [tierInfo, setTierInfo] = useState<ReturnType<typeof getCurrentTier> | null>(null);

    // Fetch SHULEVITZ holdings when wallet connects
    useEffect(() => {
        if (publicKey) {
            getShulevitzHoldingsUSD(publicKey.toString()).then(holdings => {
                setHoldingsUSD(holdings);
                const fee = calculateFeeBps(holdings, apeMode, buyShulevitzMode);
                setCurrentFeeBps(fee);
                setTierInfo(getCurrentTier(holdings));
                console.log(`[FEE TIER] Holdings: $${holdings}, Fee: ${fee} bps`);
            });
        } else {
            setHoldingsUSD(0);
            setCurrentFeeBps(calculateFeeBps(0, apeMode, buyShulevitzMode));
            setTierInfo(null);
        }
    }, [publicKey, apeMode, buyShulevitzMode]);

    // Load Jupiter script
    useEffect(() => {
        const script = document.createElement("script");
        script.src = JUPITER_SCRIPT_SRC;
        script.onload = () => setIsLoaded(true);
        script.onerror = () => console.error("Jupiter script failed to load");
        document.head.appendChild(script);
    }, []);

    // Re-initialize Jupiter when mode or fee changes
    useEffect(() => {
        if (isLoaded && window.Jupiter) {
            if (window.Jupiter.close) {
                window.Jupiter.close();
            }

            const timer = setTimeout(() => {
                window.Jupiter.init({
                    displayMode: "integrated",
                    integratedTargetId: "integrated-terminal",
                    endpoint: "https://mainnet.helius-rpc.com/?api-key=e36d269b-1bf1-4c2a-9efd-47d319ca4882",
                    platformFeeAndAccounts: {
                        referralAccount: "315sEtamwE8CvKJrARkBRW6kwMDxP8WRPnFnBY4CBA7r",
                        // DYNAMIC FEE based on holdings + mode
                        feeBps: currentFeeBps,
                    },
                    formProps: {
                        fixedInputMint: false,
                        fixedOutputMint: buyShulevitzMode,
                        initialSlippageBps: apeMode ? 100 : 50,
                        initialInputMint: "So11111111111111111111111111111111111111112",
                        initialOutputMint: buyShulevitzMode ? SHULEVITZ_MINT : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    },
                    defaultExplorer: "Solscan",
                    priorityLevel: apeMode ? "veryHigh" : "medium",
                    strictTokenList: false,
                    passThroughWallet: wallet ? wallet.adapter : null,
                    onSuccess: async ({ txid, swapResult }: any) => {
                        console.log("Swap Successful!", txid);
                        if (publicKey) {
                            const walletAddr = publicKey.toString();
                            // Estimate swap value (simplified - real implementation would parse swapResult)
                            const estimatedVolumeUSD = 100; // Placeholder - would calculate from swap data
                            const feePaid = (estimatedVolumeUSD * currentFeeBps) / 10000;

                            // Track volume, fees, and award XP
                            await Promise.all([
                                addPoints(walletAddr, 100),
                                addVolume(walletAddr, estimatedVolumeUSD),
                                addFeesPaid(walletAddr, feePaid)
                            ]);

                            // Clear balance cache after swap (holdings may have changed)
                            clearBalanceCache();

                            alert(`Swap Successful! +100 XP Earned! 🚀\nTx: ${txid}`);
                        }
                    },
                    onSwapError: ({ error }: any) => {
                        console.error("Swap Error:", error);
                    }
                });
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isLoaded, wallet, publicKey, apeMode, buyShulevitzMode, currentFeeBps]);

    return (
        <div className="w-full max-w-md space-y-4">
            {/* Ape Mode Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-4 backdrop-blur-md transition-colors hover:border-white/10">
                <div className="flex items-center gap-3">
                    <div className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-500 ${apeMode ? 'bg-primary text-black shadow-[0_0_15px_rgba(235,255,0,0.4)]' : 'bg-white/5 text-muted-foreground'}`}>
                        <Loader2 className={apeMode ? "animate-spin" : "hidden"} size={20} />
                        <span className={`absolute transition-all duration-300 ${apeMode ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>🦍</span>
                        <span className={`absolute transition-all duration-300 ${apeMode ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>🚀</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black tracking-wide text-white">APE MODE</span>
                            {apeMode && <span className="text-[10px] font-bold text-primary animate-pulse">ACTIVE</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">Auto-Slippage (1%) & Priority Fees</div>
                    </div>
                </div>

                <button
                    onClick={() => setApeMode(!apeMode)}
                    className={`relative h-8 w-14 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black ${apeMode ? 'bg-primary shadow-[0_0_15px_rgba(235,255,0,0.5)]' : 'bg-white/10'}`}
                >
                    <motion.div
                        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md"
                        initial={false}
                        animate={{
                            x: apeMode ? 28 : 4,
                            scale: apeMode ? 1.1 : 1
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30
                        }}
                    />
                </button>
            </div>

            {/* Shulevitz 0% Fee Promo */}
            <button
                onClick={() => setBuyShulevitzMode(!buyShulevitzMode)}
                className={`w-full rounded-xl border p-3 text-sm font-bold transition-all ${buyShulevitzMode
                    ? "border-green-500 bg-green-500/10 text-green-400 shadow-[0_0_20px_rgba(74,222,128,0.2)]"
                    : "border-white/5 bg-white/5 text-muted-foreground hover:bg-white/10"
                    }`}
            >
                {buyShulevitzMode ? "🔥 BUYING $SHULEVITZ (0% FEE ACTIVE)" : "✨ Buy $SHULEVITZ (0% Trading Fee)"}
            </button>

            <div className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
                <div className="p-4 bg-black/40 backdrop-blur-sm border-b border-white/5 flex justify-between items-center">
                    <span className="font-bold text-white">PRO TERMINAL</span>
                    <div className="flex gap-2">
                        {buyShulevitzMode && <span className="text-[10px] bg-green-500 text-black px-2 py-0.5 rounded-full font-bold">0% FEE</span>}
                        {apeMode && <span className="text-[10px] bg-primary text-black px-2 py-0.5 rounded-full font-bold">APE ON</span>}
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                </div>

                {/* Terminal container - avoid key prop to prevent remounts */}
                <div id="integrated-terminal" className="h-[600px] w-full bg-black flex items-center justify-center text-muted-foreground">
                    {!isLoaded && (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-primary" />
                            <span>Initializing Quantum Uplink...</span>
                        </div>
                    )}
                </div>

                <style jsx global>{`
                    /* Custom overrides to match 'Aggressive Dark' theme */
                    #integrated-terminal .jup-container {
                        background: #000000 !important;
                    }
                `}</style>
            </div>
        </div>
    );
}
