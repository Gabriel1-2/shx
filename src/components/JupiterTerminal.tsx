"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2, Zap, Sparkles, TrendingDown } from "lucide-react";
import { addPoints, addVolume, addFeesPaid } from "@/lib/points";
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
    const [isBuyingSHX, setIsBuyingSHX] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastInitFeeBps = useRef<number | null>(null);
    const currentOutputMint = useRef<string>(USDC_MINT);

    // ─── REFS to avoid stale closures in Jupiter callbacks ───
    const publicKeyRef = useRef(publicKey);
    publicKeyRef.current = publicKey;
    const feeBpsRef = useRef(0);

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

    // Init Jupiter with a specific fee
    const initJupiter = useCallback((feeBps: number) => {
        if (!isLoaded || !window.Jupiter) return;

        try {
            const formProps: any = {
                fixedInputMint: false,
                fixedOutputMint: false,
                initialInputMint: SOL_MINT,
                initialOutputMint: USDC_MINT,
                initialSlippageBps: 50,
            };

            // Only add referral fee if > 0 (SHX buys = 0% = no referral)
            if (feeBps > 0) {
                formProps.referralAccount = REFERRAL_ACCOUNT;
                formProps.referralFee = feeBps;
            }

            window.Jupiter.init({
                displayMode: "integrated",
                integratedTargetId: "jupiter-terminal",
                endpoint: "https://mainnet.helius-rpc.com/?api-key=e36d269b-1bf1-4c2a-9efd-47d319ca4882",
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
                                lastInitFeeBps.current = null; // Force re-init
                                initJupiter(newFee);
                            }, 300);
                        }
                    }
                },

                // ─── ANALYTICS CALLBACKS ──────────────────────
                onSuccess: async (params: any) => {
                    const { txid, swapResult, quoteResponseMeta } = params;
                    console.log("✅ Swap Successful!", txid);
                    console.log("[Jupiter] Full callback keys:", Object.keys(params));
                    console.log("[Jupiter] swapResult:", JSON.stringify(swapResult, null, 2));
                    console.log("[Jupiter] quoteResponseMeta:", JSON.stringify(quoteResponseMeta, null, 2));
                    setLastTx(txid);

                    // Use REFS (not closure variables) to always get the latest wallet/fee
                    const currentPubKey = publicKeyRef.current;
                    if (!currentPubKey) {
                        console.warn("[Analytics] No wallet connected (publicKeyRef is null), skipping.");
                        return;
                    }

                    const walletAddr = currentPubKey.toString();
                    let volumeUSD = 0;
                    let inputSymbol = "Unknown";
                    let outputSymbol = "Unknown";
                    let inputAmount = 0;
                    let outputAmount = 0;
                    let inputMint = "";
                    let outputMint = "";

                    const KNOWN_DECIMALS: Record<string, number> = {
                        "So11111111111111111111111111111111111111112": 9,       // SOL
                        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 6,    // USDC
                        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": 6,    // USDT
                        "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": 5,   // BONK
                        "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": 6,   // WIF
                        "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": 6,    // JUP
                        "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q": 9,    // SHX
                    };

                    const STABLECOINS = [
                        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  // USDC
                        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  // USDT
                        "USDH1SM1ojwWUga67PBrgQm7e7LZdPJRMghS7gsBSfB",   // USDH
                    ];

                    // ─── STRATEGY 1: Try to parse from Jupiter callback ───
                    try {
                        const rawQuote = quoteResponseMeta?.quoteResponse
                            || quoteResponseMeta?.original
                            || swapResult?.quoteResponse
                            || swapResult;

                        if (rawQuote) {
                            inputMint = rawQuote.inputMint || rawQuote.inputAddress || "";
                            outputMint = rawQuote.outputMint || rawQuote.outputAddress || "";
                            const rawIn = rawQuote.inAmount ?? rawQuote.inputAmount ?? 0;
                            const rawOut = rawQuote.outAmount ?? rawQuote.outputAmount ?? 0;
                            const inDec = KNOWN_DECIMALS[inputMint] ?? 6;
                            const outDec = KNOWN_DECIMALS[outputMint] ?? 6;
                            inputAmount = Number(rawIn) / Math.pow(10, inDec);
                            outputAmount = Number(rawOut) / Math.pow(10, outDec);
                            if (isNaN(inputAmount)) inputAmount = 0;
                            if (isNaN(outputAmount)) outputAmount = 0;
                            console.log(`[Strategy 1] Parsed: ${inputAmount} (${inputMint.slice(0,6)}) → ${outputAmount} (${outputMint.slice(0,6)})`);
                        }
                    } catch (e) {
                        console.warn("[Strategy 1] Failed to parse Jupiter callback:", e);
                    }

                    // ─── STRATEGY 2: Helius Enhanced Transaction API fallback ───
                    if (inputAmount === 0 && txid) {
                        console.log("[Strategy 2] Callback parsing failed, using Helius Enhanced TX API...");
                        try {
                            // Wait briefly for tx to be confirmed on-chain
                            await new Promise(r => setTimeout(r, 3000));

                            const heliusRes = await fetch(
                                "https://mainnet.helius-rpc.com/?api-key=e36d269b-1bf1-4c2a-9efd-47d319ca4882",
                                {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        jsonrpc: "2.0",
                                        id: "shx-vol",
                                        method: "getTransaction",
                                        params: [txid, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
                                    }),
                                }
                            );
                            const heliusData = await heliusRes.json();
                            const tx = heliusData?.result;

                            if (tx?.meta && !tx.meta.err) {
                                // Parse token balance changes from pre/post token balances
                                const preBalances = tx.meta.preTokenBalances || [];
                                const postBalances = tx.meta.postTokenBalances || [];

                                // Find all token balance changes for this wallet
                                const accountKeys = tx.transaction?.message?.accountKeys?.map((k: any) => 
                                    typeof k === 'string' ? k : k.pubkey
                                ) || [];
                                
                                const changes: { mint: string; change: number; decimals: number }[] = [];

                                for (const post of postBalances) {
                                    const owner = post.owner || accountKeys[post.accountIndex];
                                    if (owner !== walletAddr) continue;
                                    
                                    const pre = preBalances.find((p: any) => 
                                        p.mint === post.mint && (p.owner || accountKeys[p.accountIndex]) === walletAddr
                                    );
                                    const preAmt = pre ? Number(pre.uiTokenAmount?.amount || 0) : 0;
                                    const postAmt = Number(post.uiTokenAmount?.amount || 0);
                                    const decimals = post.uiTokenAmount?.decimals || KNOWN_DECIMALS[post.mint] || 6;
                                    const diff = (postAmt - preAmt) / Math.pow(10, decimals);

                                    if (Math.abs(diff) > 0.000001) {
                                        changes.push({ mint: post.mint, change: diff, decimals });
                                    }
                                }

                                // Also check SOL balance change (lamport diff)
                                const walletIdx = accountKeys.indexOf(walletAddr);
                                if (walletIdx >= 0) {
                                    const preSol = (tx.meta.preBalances?.[walletIdx] || 0) / 1e9;
                                    const postSol = (tx.meta.postBalances?.[walletIdx] || 0) / 1e9;
                                    const solDiff = postSol - preSol;
                                    // Only count significant SOL changes (not just tx fees)
                                    if (Math.abs(solDiff) > 0.001) {
                                        changes.push({ mint: SOL_MINT, change: solDiff, decimals: 9 });
                                    }
                                }

                                console.log("[Strategy 2] Token changes:", changes);

                                // The token that decreased = input, token that increased = output
                                const spent = changes.find(c => c.change < 0);
                                const received = changes.find(c => c.change > 0);

                                if (spent) {
                                    inputMint = spent.mint;
                                    inputAmount = Math.abs(spent.change);
                                }
                                if (received) {
                                    outputMint = received.mint;
                                    outputAmount = received.change;
                                }
                                console.log(`[Strategy 2] Parsed: ${inputAmount} (${inputMint.slice(0,6)}) → ${outputAmount} (${outputMint.slice(0,6)})`);
                            }
                        } catch (heliusErr) {
                            console.error("[Strategy 2] Helius lookup failed:", heliusErr);
                        }
                    }

                    // ─── CALCULATE USD VOLUME ───
                    if (inputAmount > 0 || outputAmount > 0) {
                        if (STABLECOINS.includes(inputMint)) {
                            volumeUSD = inputAmount;
                        } else if (STABLECOINS.includes(outputMint)) {
                            volumeUSD = outputAmount;
                        } else {
                            // Neither is a stablecoin — fetch price
                            const mintToPrice = inputMint || outputMint;
                            try {
                                const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${mintToPrice}`);
                                const priceData = await priceRes.json();
                                const tokenPrice = parseFloat(priceData?.data?.[mintToPrice]?.price || "0");
                                if (tokenPrice > 0) {
                                    volumeUSD = inputAmount > 0 ? inputAmount * tokenPrice : outputAmount * tokenPrice;
                                } else {
                                    // DexScreener fallback
                                    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintToPrice}`);
                                    const dexData = await dexRes.json();
                                    const dexPrice = parseFloat(dexData?.pairs?.[0]?.priceUsd || "0");
                                    if (dexPrice > 0) {
                                        volumeUSD = inputAmount > 0 ? inputAmount * dexPrice : outputAmount * dexPrice;
                                    }
                                }
                            } catch (priceErr) {
                                console.warn("[Volume] Price fetch failed:", priceErr);
                            }
                        }
                    }

                    // Resolve symbols
                    try {
                        const mints = [inputMint, outputMint].filter(Boolean).join(",");
                        if (mints) {
                            const symbolRes = await fetch(`https://api.jup.ag/price/v2?ids=${mints}`);
                            const symbolData = await symbolRes.json();
                            inputSymbol = symbolData?.data?.[inputMint]?.mintSymbol || (inputMint === SOL_MINT ? "SOL" : inputMint.slice(0, 6));
                            outputSymbol = symbolData?.data?.[outputMint]?.mintSymbol || (outputMint === SOL_MINT ? "SOL" : outputMint.slice(0, 6));
                        }
                    } catch {
                        inputSymbol = inputMint === SOL_MINT ? "SOL" : inputMint.slice(0, 6);
                        outputSymbol = outputMint === SOL_MINT ? "SOL" : outputMint.slice(0, 6);
                    }

                    // Ensure no NaN values
                    if (isNaN(volumeUSD)) volumeUSD = 0;
                    if (isNaN(inputAmount)) inputAmount = 0;
                    if (isNaN(outputAmount)) outputAmount = 0;

                    // Calculate fee and XP
                    const currentFeeBps = feeBpsRef.current;
                    const actualFeePct = isSHXBuy(outputMint) ? 0 : currentFeeBps / 10000;
                    const feeUSD = volumeUSD * actualFeePct;
                    const xpEarned = Math.max(100, Math.floor(volumeUSD * 10));

                    console.log(`[Analytics] FINAL: vol=$${volumeUSD.toFixed(4)}, in=${inputAmount}, out=${outputAmount}, fee=${actualFeePct * 100}%, xp=${xpEarned}`);

                    await Promise.all([
                        addPoints(walletAddr, xpEarned),
                        addVolume(walletAddr, volumeUSD),
                        addFeesPaid(walletAddr, feeUSD),
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

                    console.log(`[Analytics] ✅ Saved: +${xpEarned} XP, $${volumeUSD.toFixed(2)} vol`);
                },

                onSwapError: ({ error }: any) => {
                    console.error("❌ Swap Error:", error);
                },
            });
            lastInitFeeBps.current = feeBps;
            setIsInitialized(true);
        } catch (e) {
            console.error("[Jupiter] Init failed:", e);
        }
    }, [isLoaded, wallet, publicKey, tierData.feeBps]);

    // Initialize Jupiter when script loads, wallet changes, or fee tier changes
    useEffect(() => {
        if (!isLoaded || !window.Jupiter) return;

        // Only re-init if the fee actually changed
        const effectiveFeeBps = isBuyingSHX ? 0 : tierData.feeBps;
        if (lastInitFeeBps.current === effectiveFeeBps && isInitialized) return;

        const timer = setTimeout(() => {
            initJupiter(effectiveFeeBps);
        }, 200);

        return () => clearTimeout(timer);
    }, [isLoaded, wallet, publicKey, tierData.feeBps, isBuyingSHX, initJupiter]);

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
            <div className="flex items-center justify-between rounded-t-2xl bg-black/60 px-4 md:px-5 py-3 md:py-3.5 border border-b-0 border-white/10 backdrop-blur-xl">
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
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium hidden sm:inline">
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
