"use client";

import { useState, useCallback, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { Loader2, ArrowDownCircle, Settings, ShieldCheck, X } from "lucide-react";
import { addPoints, addVolume, addFeesPaid } from "@/lib/points";
import { calculateFeeBps } from "@/lib/feeTiers";
import { getShulevitzHoldingsUSD, clearBalanceCache } from "@/lib/tokenBalance";
import { addReferralEarnings } from "@/lib/referrals";
import { saveSwapTransaction } from "@/lib/transactions";
import { TokenSelector } from "./TokenSelector";
import { useTokenBalance, useTokenPrice } from "@/hooks/useTokenData";
import { useToast } from "./Toast";
import { useSwapEffects } from "@/hooks/useSwapEffects";

// Constants
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SHULEVITZ_MINT = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";

interface TokenInfo {
    symbol: string;
    address: string;
    decimals: number;
    logoURI?: string;
}

export default function CustomSwap() {
    const { connection } = useConnection();
    const { publicKey, signTransaction, connected } = useWallet();
    const { setVisible } = useWalletModal();
    const { showToast } = useToast();
    const { onSwapSuccess } = useSwapEffects();

    // Token State
    const [tokens, setTokens] = useState<{ input: TokenInfo; output: TokenInfo }>({
        input: { symbol: "SOL", address: SOL_MINT, decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" },
        output: { symbol: "SHULEVITZ", address: SHULEVITZ_MINT, decimals: 6, logoURI: "/shulevitz-logo.png" }
    });

    // Selector State
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [activeSelector, setActiveSelector] = useState<"input" | "output">("input");

    // Swap State
    const [amount, setAmount] = useState("");
    const [quote, setQuote] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [txState, setTxState] = useState<"idle" | "signing" | "confirming" | "success" | "error">("idle");

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [slippage, setSlippage] = useState(0.5); // Default 0.5%
    const [apeMode, setApeMode] = useState(false);

    // Real Data Hooks
    const { balance: inputBalance } = useTokenBalance(tokens.input.address, tokens.input.decimals);
    const { balance: outputBalance } = useTokenBalance(tokens.output.address, tokens.output.decimals);
    const inputPrice = useTokenPrice(tokens.input.address);
    const outputPrice = useTokenPrice(tokens.output.address);

    // Fee State
    const [holdingsUSD, setHoldingsUSD] = useState(0);
    const [feeBps, setFeeBps] = useState(50);

    const openSelector = (type: "input" | "output") => {
        setActiveSelector(type);
        setSelectorOpen(true);
    };

    const handleTokenSelect = (token: any) => {
        if (activeSelector === "input") {
            setTokens(prev => ({
                ...prev,
                input: { symbol: token.symbol, address: token.address, decimals: token.decimals || 9, logoURI: token.logoURI }
            }));
        } else {
            setTokens(prev => ({
                ...prev,
                output: { symbol: token.symbol, address: token.address, decimals: token.decimals || 9, logoURI: token.logoURI }
            }));
        }
        setQuote(null); // Clear old quote
    };

    // Fetch Holdings & Fees
    useEffect(() => {
        if (publicKey) {
            getShulevitzHoldingsUSD(publicKey.toString()).then(usd => {
                setHoldingsUSD(usd);
                setFeeBps(calculateFeeBps(usd, apeMode, tokens.output.address === SHULEVITZ_MINT));
            });
        }
    }, [publicKey, apeMode, tokens.output.address]);

    // Fetch Quote via PROXY
    const fetchQuote = useCallback(async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            setQuote(null);
            return;
        }

        setLoading(true);
        setQuote(null);

        // AbortController to cancel previous requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            const amountAtoms = Math.floor(Number(amount) * Math.pow(10, tokens.input.decimals));
            const slippageBps = Math.round(slippage * 100);

            const params = new URLSearchParams({
                inputMint: tokens.input.address,
                outputMint: tokens.output.address,
                amount: amountAtoms.toString(),
                slippageBps: slippageBps.toString(),
                platformFeeBps: feeBps.toString(),
            });

            console.log("Fetching quote for:", params.toString());

            const res = await fetch(`/api/proxy/quote?${params.toString()}`, {
                signal: controller.signal
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`API Error: ${res.status} ${errText}`);
            }

            const data = await res.json();

            if (data.error) throw new Error(data.error);
            setQuote(data);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Quote fetch timed out or aborted');
            } else {
                console.error("Quote Error:", error);
                setQuote(null);
            }
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    }, [amount, slippage, tokens, feeBps]);

    // Debounced Quote Fetch
    useEffect(() => {
        const timer = setTimeout(() => {
            if (amount && Number(amount) > 0) fetchQuote();
        }, 500);
        return () => clearTimeout(timer);
    }, [amount, fetchQuote]);

    // Calculate output amount from quote
    const outputAmount = quote ? (Number(quote.outAmount) / Math.pow(10, tokens.output.decimals)) : 0;
    const outputUSD = outputAmount * outputPrice;

    // Execute Swap via PROXY
    const executeSwap = async () => {
        if (!quote || !publicKey || !signTransaction) return;
        setTxState("signing");

        try {
            const swapRes = await fetch("/api/proxy/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: publicKey.toString(),
                    wrapAndUnwrapSol: true,
                    feeAccount: "315sEtamwE8CvKJrARkBRW6kwMDxP8WRPnFnBY4CBA7r"
                })
            });

            const swapData = await swapRes.json();
            if (swapData.error) throw new Error(swapData.error);

            // Deserialize Transaction
            const binaryString = atob(swapData.swapTransaction);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const transaction = VersionedTransaction.deserialize(bytes);

            // Sign Transaction
            const signedTx = await signTransaction(transaction);

            // Send Transaction
            setTxState("confirming");
            const rawTransaction = signedTx.serialize();
            const txid = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true,
                maxRetries: 2
            });

            // Confirm Transaction
            const latestBlockHash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: txid
            });

            // Success!
            setTxState("success");
            onSwapSuccess(); // 🎉 Confetti + Sound!

            showToast({
                type: "success",
                title: "Swap Successful!",
                message: `Swapped ${amount} ${tokens.input.symbol} for ${outputAmount.toFixed(4)} ${tokens.output.symbol}`,
                txId: txid
            });

            // Track rewards + referral earnings + save transaction
            const volumeUSD = Number(amount) * inputPrice;
            const feeUSD = volumeUSD * (feeBps / 10000);
            await Promise.all([
                addPoints(publicKey.toString(), Math.floor(volumeUSD * 10)),
                addVolume(publicKey.toString(), volumeUSD),
                addFeesPaid(publicKey.toString(), feeUSD),
                addReferralEarnings(publicKey.toString(), feeUSD, volumeUSD),
                saveSwapTransaction({
                    wallet: publicKey.toString(),
                    inputToken: tokens.input.symbol,
                    inputAmount: Number(amount),
                    inputMint: tokens.input.address,
                    outputToken: tokens.output.symbol,
                    outputAmount: outputAmount,
                    outputMint: tokens.output.address,
                    volumeUSD: volumeUSD,
                    feePaid: feeUSD,
                    txSignature: txid
                })
            ]);

            clearBalanceCache();

            setTimeout(() => {
                setTxState("idle");
                setAmount("");
                setQuote(null);
            }, 3000);

        } catch (error: any) {
            console.error("Swap Failed:", error);
            setTxState("error");
            showToast({
                type: "error",
                title: "Swap Failed",
                message: error.message || "Transaction was rejected or failed"
            });
            setTimeout(() => setTxState("idle"), 3000);
        }
    };

    // Slippage presets
    const slippagePresets = [0.1, 0.5, 1.0];

    return (
        <div className="w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between rounded-2xl bg-black/60 p-4 border border-white/10 backdrop-blur-xl mb-4">
                <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-5 h-5 bg-green-500 blur-sm opacity-50 animate-pulse rounded-full"></div>
                        <ShieldCheck className="relative text-green-400 z-10" size={18} />
                    </div>
                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 text-sm">
                        SHADOW ROUTER (DE)
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Settings size={16} className="text-muted-foreground" />
                    </button>
                    <button
                        onClick={() => setApeMode(!apeMode)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all border ${apeMode
                            ? 'bg-primary/20 border-primary text-primary'
                            : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'
                            }`}
                    >
                        {apeMode ? '🦍 APE' : '🚀 NORMAL'}
                    </button>
                </div>
            </div>

            {/* Quick Swap Pairs */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Quick:</span>
                {[
                    {
                        from: { symbol: "SOL", address: SOL_MINT, decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" },
                        to: { symbol: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png" }
                    },
                    {
                        from: { symbol: "SOL", address: SOL_MINT, decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" },
                        to: { symbol: "SHX", address: SHULEVITZ_MINT, decimals: 6, logoURI: "/shulevitz-logo.png" }
                    },
                    {
                        from: { symbol: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png" },
                        to: { symbol: "SOL", address: SOL_MINT, decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" }
                    },
                ].map((pair, i) => (
                    <button
                        key={i}
                        onClick={() => {
                            setTokens({
                                input: pair.from,
                                output: pair.to
                            });
                            setAmount("");
                            setQuote(null);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-xs"
                    >
                        <span className="font-bold text-white">{pair.from.symbol}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-bold text-primary">{pair.to.symbol}</span>
                    </button>
                ))}
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="mb-4 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-white">Slippage Tolerance</span>
                        <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/10 rounded">
                            <X size={14} className="text-muted-foreground" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        {slippagePresets.map((preset) => (
                            <button
                                key={preset}
                                onClick={() => setSlippage(preset)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${slippage === preset
                                    ? 'bg-primary text-black'
                                    : 'bg-white/5 text-white hover:bg-white/10'
                                    }`}
                            >
                                {preset}%
                            </button>
                        ))}
                        <div className="flex-1">
                            <input
                                type="number"
                                value={slippage}
                                onChange={(e) => setSlippage(Math.max(0.01, Math.min(50, Number(e.target.value))))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white text-right outline-none focus:border-primary/50"
                                step="0.1"
                            />
                        </div>
                        <span className="text-xs text-muted-foreground">%</span>
                    </div>
                </div>
            )}

            {/* Swap Card */}
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 shadow-xl">

                {/* Input Section */}
                <div className="rounded-xl bg-black/50 p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-muted-foreground font-medium">YOU PAY</span>
                        <button
                            onClick={() => setAmount(inputBalance.toString())}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
                        >
                            <span>Balance:</span>
                            <span className="font-mono text-white/80">{inputBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">MAX</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-transparent text-3xl font-bold text-white placeholder-white/20 outline-none"
                            />
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                                ≈ ${(Number(amount || 0) * inputPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <button
                            onClick={() => openSelector("input")}
                            className="flex items-center gap-2 rounded-xl bg-white/5 p-2 pr-3 border border-white/5 hover:bg-white/10 transition-all shrink-0"
                        >
                            <img
                                src={tokens.input.logoURI}
                                alt={tokens.input.symbol}
                                className="h-8 w-8 rounded-full bg-white/5"
                                onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${tokens.input.symbol}&background=1a1a1a&color=fff&size=32&bold=true`; }}
                            />
                            <span className="font-bold text-sm text-white">{tokens.input.symbol}</span>
                            <span className="opacity-40 text-white text-xs">▼</span>
                        </button>
                    </div>
                </div>

                {/* Swap Direction Button */}
                <div className="relative -my-4 z-10 flex justify-center">
                    <button
                        onClick={() => {
                            const temp = tokens.input;
                            setTokens({ input: tokens.output, output: temp });
                            setAmount("");
                            setQuote(null);
                        }}
                        className="bg-[#0A0A0A] p-1.5 rounded-xl border border-white/10 hover:border-white/20 transition-colors hover:rotate-180 duration-300"
                    >
                        <div className="bg-white/5 p-2 rounded-lg text-white/50 hover:text-primary transition-colors">
                            <ArrowDownCircle size={20} />
                        </div>
                    </button>
                </div>

                {/* Output Section */}
                <div className="rounded-xl bg-black/50 p-4 border border-white/5 mt-0">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-muted-foreground font-medium">YOU RECEIVE</span>
                        <span className="text-xs text-muted-foreground">
                            Balance: <span className="font-mono text-white/80">{outputBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <div className={`text-3xl font-bold ${quote ? 'text-primary' : 'text-white/20'}`}>
                                {loading ? (
                                    <span className="animate-pulse">...</span>
                                ) : outputAmount > 0 ? (
                                    outputAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                                ) : (
                                    "0.00"
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                                ≈ ${outputUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <button
                            onClick={() => openSelector("output")}
                            className="flex items-center gap-2 rounded-xl bg-white/5 p-2 pr-3 border border-white/5 hover:bg-white/10 transition-all shrink-0"
                        >
                            <img
                                src={tokens.output.logoURI}
                                alt={tokens.output.symbol}
                                className="h-8 w-8 rounded-full bg-white/5"
                                onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${tokens.output.symbol}&background=1a1a1a&color=fff&size=32&bold=true`; }}
                            />
                            <span className="font-bold text-sm text-white">{tokens.output.symbol}</span>
                            <span className="opacity-40 text-white text-xs">▼</span>
                        </button>
                    </div>
                    {quote && (
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-[10px] font-bold bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20">
                                BEST PRICE
                            </span>
                            <span className="text-[10px] font-bold bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20">
                                JUPITER ⚡
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                                Slippage: {slippage}%
                            </span>
                        </div>
                    )}
                </div>

                {/* Quote Details */}
                {quote && (
                    <div className="mt-4 px-1 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Rate</span>
                            <span className="font-mono text-white/60">
                                1 {tokens.input.symbol} = {(outputAmount / Number(amount)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokens.output.symbol}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Price Impact</span>
                            <span className={`${Number(quote.priceImpactPct) > 2 ? 'text-red-400' : 'text-green-400'}`}>
                                {Number(quote.priceImpactPct) < 0.01 ? "< 0.01%" : `${Number(quote.priceImpactPct).toFixed(2)}%`}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Platform Fee</span>
                            <span className={`${feeBps === 0 ? 'text-green-400 font-bold' : feeBps < 50 ? 'text-green-400' : 'text-white/60'}`}>
                                {feeBps === 0 ? 'FREE 🎉' : `${(feeBps / 100).toFixed(2)}%`}
                                {feeBps > 0 && feeBps < 50 && <span className="text-green-400 ml-1">(-{((50 - feeBps) / 50 * 100).toFixed(0)}%)</span>}
                            </span>
                        </div>
                    </div>
                )}

                {/* Swap Button */}
                {!connected ? (
                    <button
                        onClick={() => setVisible(true)}
                        className="mt-4 w-full rounded-xl py-4 font-bold text-lg bg-gradient-to-r from-primary to-lime-400 text-black hover:opacity-90 transition-all"
                    >
                        Connect Wallet
                    </button>
                ) : (
                    <button
                        onClick={executeSwap}
                        disabled={!quote || loading || txState === 'signing' || txState === 'confirming'}
                        className={`mt-4 w-full rounded-xl py-4 font-bold text-lg transition-all ${txState === 'success' ? 'bg-green-500 text-black' :
                            txState === 'error' ? 'bg-red-500 text-white' :
                                'bg-gradient-to-r from-primary to-lime-400 text-black hover:opacity-90'
                            } ${(!quote || loading) && 'opacity-50 cursor-not-allowed'}`}
                    >
                        {loading ? <Loader2 className="mx-auto animate-spin" /> :
                            txState === 'signing' ? "SIGN IN WALLET..." :
                                txState === 'confirming' ? "CONFIRMING..." :
                                    txState === 'success' ? "SUCCESS! 🚀" :
                                        txState === 'error' ? "FAILED ❌" :
                                            txState === 'error' ? "FAILED ❌" :
                                                !amount || Number(amount) <= 0 ? "ENTER AMOUNT" :
                                                    loading ? "FETCHING QUOTE..." : // Move specific loading text here
                                                        !quote ? "NO ROUTE FOUND / RETRY" : // If not loading and no quote, it failed
                                                            "SWAP NOW"}
                    </button>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground font-medium mt-4 opacity-60">
                <span className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Operational
                </span>
                <span>•</span>
                <span>Verified Route</span>
            </div>

            <TokenSelector
                isOpen={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                onSelect={handleTokenSelect}
            />
        </div>
    );
}
