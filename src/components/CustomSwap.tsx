"use client";

import { useState, useCallback, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Loader2, ArrowDownCircle, Settings, ShieldCheck, X, ArrowUpDown, Clock, BarChart2, Maximize2, Minimize2 } from "lucide-react";
import { addPoints, addVolume, addFeesPaid } from "@/lib/points";
import { calculateFeeBps } from "@/lib/feeTiers";
import { getShulevitzHoldingsUSD, clearBalanceCache } from "@/lib/tokenBalance";
import { addReferralEarnings } from "@/lib/referrals";
import { saveSwapTransaction } from "@/lib/transactions";
import { TokenSelector } from "./TokenSelector";
import { useTokenBalance, useTokenPrice } from "@/hooks/useTokenData";
import { useToast } from "./Toast";
import { useSwapEffects } from "@/hooks/useSwapEffects";
import { useLimitOrders } from "@/hooks/useLimitOrders";
import { useDCA } from "@/hooks/useDCA";
import { OpenOrders } from "./OpenOrders";
import { ActiveDCAs } from "./ActiveDCAs";
import { ADMIN_WALLET_SOL, SOL_MINT, SHULEVITZ_MINT } from "@/lib/constants";

// Constants
const TOKEN_PROGRAM_ID_STR = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

interface TokenInfo {
    symbol: string;
    address: string;
    decimals: number;
    logoURI?: string;
}

type Tab = "swap" | "limit" | "dca";

interface CustomSwapProps {
    onToggleChart?: () => void;
    onPairChange?: (address: string) => void;
    isChartOpen?: boolean;
}

export default function CustomSwap({ onToggleChart, onPairChange, isChartOpen = false }: CustomSwapProps) {
    const { connection } = useConnection();
    const { publicKey, signTransaction, connected } = useWallet();
    const { setVisible } = useWalletModal();
    const { showToast } = useToast();
    const { onSwapSuccess } = useSwapEffects();

    // Hooks for Advanced Features
    const { createLimitOrder, loading: limitLoading } = useLimitOrders();
    const { createDCA, loading: dcaLoading } = useDCA();

    // Tab State
    const [activeTab, setActiveTab] = useState<Tab>("swap");

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

    // Limit State
    const [limitRate, setLimitRate] = useState("");

    // DCA State
    const [dcaInterval, setDcaInterval] = useState<"Day" | "Hour" | "Minute">("Day");

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
        setQuote(null);
        setTokens(prev => {
            const newTokens = {
                ...prev,
                [activeSelector]: { symbol: token.symbol, address: token.address, decimals: token.decimals || 9, logoURI: token.logoURI }
            };

            // Notify parent of output token change (usually want to chart the output or the pair)
            // Strategy: Chart the non-SOL token if possible, else output.
            if (onPairChange) {
                const target = activeSelector === 'output' ? token.address : prev.output.address;
                // If target is SOL, maybe chart the other one?
                if (target === SOL_MINT && prev.input.address !== SOL_MINT) onPairChange(prev.input.address);
                else onPairChange(target);
            }
            return newTokens;
        });
    };

    // Calculate market rate for auto-filling Limit inputs
    useEffect(() => {
        if (inputPrice.price && outputPrice.price && !limitRate) {
            // Rate = Output / Input (How many Output for 1 Input)
            const rate = inputPrice.price / outputPrice.price;
            setLimitRate(rate.toFixed(6));
        }
    }, [inputPrice, outputPrice, activeTab]);

    // Fetch Holdings & Fees
    useEffect(() => {
        if (publicKey) {
            getShulevitzHoldingsUSD(publicKey.toString()).then(usd => {
                setHoldingsUSD(usd);
                setFeeBps(calculateFeeBps(usd, apeMode, tokens.output.address === SHULEVITZ_MINT));
            });
        }
    }, [publicKey, apeMode, tokens.output.address]);

    // Fetch Quote via PROXY (Only for Swap Tab)
    const fetchQuote = useCallback(async () => {
        if (activeTab !== 'swap') return;
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            setQuote(null);
            return;
        }

        setLoading(true);
        setQuote(null);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

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
            if (error.name !== 'AbortError') {
                console.error("Quote Error:", error);
                setQuote(null);
            }
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    }, [amount, slippage, tokens, feeBps, connection, activeTab]);

    // Debounced Quote Fetch
    useEffect(() => {
        const timer = setTimeout(() => {
            if (amount && Number(amount) > 0) fetchQuote();
        }, 500);
        return () => clearTimeout(timer);
    }, [amount, fetchQuote]);

    // Calculate output amount from quote
    const outputAmount = quote ? (Number(quote.outAmount) / Math.pow(10, tokens.output.decimals)) : 0;
    const outputUSD = outputAmount * (outputPrice.price || 0);

    // Switch Tokens Helper
    const switchTokens = () => {
        const temp = tokens.input;
        setTokens({ input: tokens.output, output: temp });
        setAmount("");
        setQuote(null);
        if (onPairChange) onPairChange(temp.address); // Sync chart to new output (which was input)
    };

    // Helper: check if user has ATA for output token
    const ensureOutputATAExists = async (): Promise<boolean> => {
        try {
            if (!publicKey) return false;
            // SOL is native, no ATA required
            if (tokens.output.address === SOL_MINT) return true;

            const ownerPub = publicKey;
            const tokenProgramId = new PublicKey(TOKEN_PROGRAM_ID_STR);
            const accounts = await connection.getParsedTokenAccountsByOwner(ownerPub, { programId: tokenProgramId });
            const has = accounts.value.some(acc => acc.account.data?.parsed?.info?.mint === tokens.output.address);
            if (has) return true;

            showToast({
                type: 'error',
                title: 'Missing Token Account',
                message: `You do not have an associated token account for ${tokens.output.symbol}. Please create it in your wallet to receive tokens.`
            });
            return false;
        } catch (e) {
            console.error('ATA check failed', e);
            return false;
        }
    };

    // Execute Swap via PROXY (collect platform fee properly)
    const executeSwap = async () => {
        if (!quote || !publicKey || !signTransaction) return;
        setTxState("signing");

        try {
            const hasAta = await ensureOutputATAExists();
            if (!hasAta) {
                setTxState('idle');
                return;
            }

            // Calculate correct Fee Account
            let feeAccount = ADMIN_WALLET_SOL.toString();
            if (feeBps > 0 && tokens.output.address !== SOL_MINT) {
                try {
                    const adminPub = new PublicKey(ADMIN_WALLET_SOL);
                    const mintPub = new PublicKey(tokens.output.address);
                    // We must find the ATA for the admin wallet for this specific output token
                    // Note: This assumes the admin wallet ALREADY has this ATA created.
                    const ata = await getAssociatedTokenAddress(mintPub, adminPub);
                    feeAccount = ata.toString();
                } catch (e) {
                    console.error("Failed to derive Admin ATA", e);
                    // Fallback to SOL wallet (will likely fail if Jup strict, but safe fallback)
                    feeAccount = ADMIN_WALLET_SOL.toString();
                }
            }

            const body = {
                quoteResponse: quote,
                userPublicKey: publicKey.toString(),
                wrapAndUnwrapSol: true,
                platformFee: {
                    feeBps: feeBps,
                    feeAccount: feeAccount
                }
            };

            const swapRes = await fetch("/api/proxy/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!swapRes.ok) throw new Error("Swap proxy failed");
            const swapData = await swapRes.json();
            if (swapData.error) throw new Error(swapData.error);

            const rawBase64 = swapData.swapTransaction as string;
            const bytes = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
            const transaction = VersionedTransaction.deserialize(bytes);

            const signedTx = await signTransaction(transaction);
            setTxState("confirming");

            const rawTransaction = signedTx.serialize();
            const txid = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                maxRetries: 2
            });

            const latestBlockHash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: txid
            });

            setTxState("success");
            onSwapSuccess();
            showToast({ type: "success", title: "Swap Successful!", message: `Tx: ${txid.slice(0, 8)}...`, txId: txid });

            // Analytics
            const volumeUSD = Number(amount) * (inputPrice.price || 0);
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
            showToast({ type: "error", title: "Swap Failed", message: error.message });
            setTimeout(() => setTxState("idle"), 3000);
        }
    };

    // Execute Limit Order
    const handleLimitOrder = async () => {
        if (!amount || !limitRate) return;
        const inAmountAtoms = Math.floor(Number(amount) * Math.pow(10, tokens.input.decimals));
        // outAmt = inAmt * rate
        const outAmt = (Number(amount) * Number(limitRate));
        const outAtoms = Math.floor(outAmt * Math.pow(10, tokens.output.decimals));

        await createLimitOrder({
            inputMint: tokens.input.address,
            outputMint: tokens.output.address,
            inAmount: inAmountAtoms,
            outAmount: outAtoms,
            expiredAt: null
        });
        setAmount("");
    };

    // Execute DCA
    const handleDCA = async () => {
        if (!amount) return;
        const inAmountAtoms = Math.floor(Number(amount) * Math.pow(10, tokens.input.decimals));

        let cycleSeconds = 60 * 60 * 24; // Day
        if (dcaInterval === "Hour") cycleSeconds = 60 * 60;
        if (dcaInterval === "Minute") cycleSeconds = 60;

        await createDCA({
            inputMint: tokens.input.address,
            outputMint: tokens.output.address,
            inAmountPerCycle: inAmountAtoms,
            cycleFrequency: cycleSeconds,
            numberOfCycles: 10 // Default 10 cycles for now, could be input too
        });
        setAmount("");
    };

    const slippagePresets = [0.1, 0.5, 1.0];

    return (
        <div className="w-full">
            {/* Header */}
            <div className="flex items-center justify-between rounded-2xl bg-black/60 p-4 border border-white/10 backdrop-blur-xl mb-4">
                <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-5 h-5 bg-green-500 blur-sm opacity-50 animate-pulse rounded-full"></div>
                        <ShieldCheck className="relative text-green-400 z-10" size={18} />
                    </div>
                    {/* Hide Title if Chart Open to save space on mobile/compact */}
                    {!isChartOpen && (
                        <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 text-sm hidden sm:block">
                            SHADOW ROUTER
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Toggle Chart Button */}
                    {onToggleChart && (
                        <button
                            onClick={onToggleChart}
                            className={`p-2 rounded-lg transition-colors border ${isChartOpen ? 'bg-primary/20 border-primary text-primary' : 'hover:bg-white/10 border-transparent text-muted-foreground'}`}
                            title="Toggle Chart"
                        >
                            {isChartOpen ? <Minimize2 size={16} /> : <BarChart2 size={16} />}
                        </button>
                    )}

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
                        {apeMode ? '🦍 APE' : 'NORMAL'}
                    </button>
                </div>
            </div>

            {/* Feature Tabs */}
            <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 mb-4 relative overflow-hidden">
                {(["swap", "limit", "dca"] as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all z-10 ${activeTab === tab
                            ? "bg-white/10 text-white shadow-lg border border-white/10"
                            : "text-muted-foreground hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Quick Swap Pairs (Only for Swap Tab) */}
            {activeTab === 'swap' && (
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
                            from: { symbol: "SHX", address: SHULEVITZ_MINT, decimals: 6, logoURI: "/shulevitz-logo.png" },
                            to: { symbol: "SOL", address: SOL_MINT, decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" }
                        },
                    ].map((pair, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setTokens({ input: pair.from, output: pair.to });
                                setAmount("");
                                setQuote(null);
                                if (onPairChange) onPairChange(pair.to.address);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-xs"
                        >
                            <span className="font-bold text-white">{pair.from.symbol}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-bold text-primary">{pair.to.symbol}</span>
                        </button>
                    ))}
                </div>
            )}

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

            {/* Main Swap/Limit/DCA Card */}
            <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-6 shadow-2xl space-y-2 relative">

                {/* Input Section */}
                <div className="rounded-2xl bg-black/50 p-5 border border-white/5 hover:border-white/10 transition-colors">
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
                                ≈ ${(Number(amount || 0) * (inputPrice.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                {/* Switch Button */}
                <div className="relative -my-5 z-10 flex justify-center">
                    <button
                        onClick={switchTokens}
                        className="p-3 bg-neutral-900 border-4 border-[#0A0A0A] rounded-xl text-primary hover:text-white hover:scale-110 hover:rotate-180 transition-all shadow-lg"
                    >
                        <ArrowUpDown size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Output Section */}
                <div className="rounded-xl bg-black/50 p-4 border border-white/5 mt-0 pt-6">
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
                                ) : activeTab === 'swap' ? (
                                    outputAmount > 0 ? outputAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "0.00"
                                ) : (
                                    "---"
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

                    {/* Tags for Best Price / Jupiter */}
                    {quote && activeTab === 'swap' && (
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

                {/* Extra Inputs for Limit/DCA (Injected here) */}
                {activeTab === 'limit' && (
                    <div className="rounded-2xl bg-black/50 p-4 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={14} className="text-primary" />
                            <span className="text-xs text-muted-foreground font-bold">LIMIT CONFIGURATION</span>
                        </div>
                        <span className="text-xs text-muted-foreground block mb-2">Target Rate (How many {tokens.output.symbol} per 1 {tokens.input.symbol})</span>
                        <input
                            type="number"
                            value={limitRate}
                            onChange={e => setLimitRate(e.target.value)}
                            className="w-full bg-transparent text-lg font-bold text-white outline-none placeholder-white/20"
                            placeholder="0.00"
                        />
                        <div className="text-xs text-muted-foreground mt-1">Current Rate: {(inputPrice.price / outputPrice.price).toFixed(6)}</div>
                    </div>
                )}

                {/* DCA Configuration */}
                {activeTab === 'dca' && (
                    <div className="rounded-2xl bg-black/50 p-4 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={14} className="text-primary" />
                            <span className="text-xs text-muted-foreground font-bold">DCA CONFIGURATION</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-muted-foreground block mb-2">Interval</span>
                                <div className="flex flex-wrap gap-2">
                                    {(['Minute', 'Hour', 'Day'] as const).map(int => (
                                        <button
                                            key={int}
                                            onClick={() => setDcaInterval(int)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${dcaInterval === int
                                                ? 'bg-primary/20 border-primary text-primary'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            {int}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* Quote Details (Swap Only) */}
                {quote && activeTab === 'swap' && (
                    <div className="mt-4 px-1 space-y-2 border-t border-white/5 pt-3">
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

                {/* Action Button */}
                {!connected ? (
                    <button
                        onClick={() => setVisible(true)}
                        className="mt-4 w-full rounded-xl py-4 font-bold text-lg bg-gradient-to-r from-primary to-lime-400 text-black hover:opacity-90 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    >
                        Connect Wallet
                    </button>
                ) : (
                    <button
                        onClick={() => {
                            if (activeTab === 'swap') executeSwap();
                            if (activeTab === 'limit') handleLimitOrder();
                            if (activeTab === 'dca') handleDCA();
                        }}
                        disabled={loading || limitLoading || dcaLoading || (activeTab === 'swap' && !quote)}
                        className={`mt-4 w-full rounded-xl py-4 font-bold text-lg transition-all ${txState === 'success' ? 'bg-green-500 text-black' :
                            txState === 'error' ? 'bg-red-500 text-white' :
                                'bg-gradient-to-r from-primary to-lime-400 text-black hover:opacity-90 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
                            } ${(!quote && activeTab === 'swap') || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? <Loader2 className="mx-auto animate-spin" /> :
                            txState === 'signing' ? "SIGN IN WALLET..." :
                                txState === 'confirming' ? "CONFIRMING..." :
                                    txState === 'success' ? "SUCCESS! 🚀" :
                                        txState === 'error' ? "FAILED ❌" :
                                            !amount || Number(amount) <= 0 ? "ENTER AMOUNT" :
                                                activeTab === 'swap' ? (!quote ? "FETCHING / NO ROUTE" : "SWAP NOW") :
                                                    activeTab === 'limit' ? "PLACE LIMIT ORDER" :
                                                        "START DCA"}
                    </button>
                )}
            </div>

            {/* Footer Info */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground font-medium mt-4 opacity-60">
                <span className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Operational
                </span>
                <span>•</span>
                <span>Verified Route</span>
                <span>•</span>
                <span>Secure</span>
            </div>

            {/* Order Lists (Below main card) */}
            {activeTab === 'limit' && (
                <div className="mt-6">
                    <OpenOrders />
                </div>
            )}
            {activeTab === 'dca' && (
                <div className="mt-6">
                    <ActiveDCAs />
                </div>
            )}

            <TokenSelector
                isOpen={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                onSelect={handleTokenSelect}
            />
        </div>
    );
}
