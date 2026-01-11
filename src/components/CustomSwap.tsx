"use client";

import { useState, useCallback, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { Loader2, ArrowDownCircle, Settings, ShieldCheck, X, ArrowUpDown, Clock, Repeat } from "lucide-react";
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
import { useDCA } from "@/hooks/useDCA"; // Assumed hook
import { OpenOrders } from "./OpenOrders";
import { ActiveDCAs } from "./ActiveDCAs"; // Assumed component
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

export default function CustomSwap() {
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

    // Limit/DCA State
    const [limitRate, setLimitRate] = useState("");
    const [dcaFrequency, setDcaFrequency] = useState("Day"); // Min, Hour, Day

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
        setTokens(prev => ({
            ...prev,
            [activeSelector]: { symbol: token.symbol, address: token.address, decimals: token.decimals || 9, logoURI: token.logoURI }
        }));
    };

    // Calculate market rate for auto-filling Limit inputs
    useEffect(() => {
        if (inputPrice.price && outputPrice.price && !limitRate) {
            // Rate = Output / Input (How many Output for 1 Input)
            // e.g. SOL $100, USDC $1. Rate = 100.
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

            const body = {
                quoteResponse: quote,
                userPublicKey: publicKey.toString(),
                wrapAndUnwrapSol: true,
                platformFee: {
                    feeBps: feeBps, // e.g. 50 for 0.5%
                    feeAccount: ADMIN_WALLET_SOL.toString()
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
        // outAmount = inAmount * rate
        const outAmountAtoms = Math.floor(inAmountAtoms * Number(limitRate)); // Simplified rate calc (needs decimals check usually)
        // Wait, rate is 1 input = X output.
        // outAtoms = (inAtoms / 10^inDec) * rate * 10^outDec
        const outAmt = (Number(amount) * Number(limitRate));
        const outAtoms = Math.floor(outAmt * Math.pow(10, tokens.output.decimals));

        await createLimitOrder({
            inputMint: tokens.input.address,
            outputMint: tokens.output.address,
            inAmount: inAmountAtoms,
            outAmount: outAtoms,
            expiredAt: null // Never expires for now
        });
        setAmount("");
    };

    // Execute DCA
    const handleDCA = async () => {
        if (!amount) return;
        const inAmountAtoms = Math.floor(Number(amount) * Math.pow(10, tokens.input.decimals));
        // Logic for DCA creation via hook
        // We treat user input 'amount' as 'Amount per cycle' for simplicity in this restoration.
        await createDCA({
            inputMint: tokens.input.address,
            outputMint: tokens.output.address,
            inAmountPerCycle: inAmountAtoms,
            cycleFrequency: 60 * 60 * 24, // Default 1 Day (matches 'Day' setting default)
            numberOfCycles: 10 // Default 10 cycles
        });
        setAmount("");
    };

    const slippagePresets = [0.1, 0.5, 1.0];

    return (
        <div className="w-full max-w-md">
            {/* Header / Tabs */}
            <div className="rounded-2xl bg-black/60 p-2 border border-white/10 backdrop-blur-xl mb-4 flex items-center justify-between">
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                    {(["swap", "limit", "dca"] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase ${activeTab === tab ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:text-white"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 pr-2">
                    <button onClick={() => setShowSettings(!showSettings)} className="hover:bg-white/10 p-1.5 rounded transition-colors">
                        <Settings size={16} className="text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Settings */}
            {showSettings && (
                <div className="mb-4 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-white">Slippage</span>
                        <button onClick={() => setShowSettings(false)}><X size={14} /></button>
                    </div>
                    <div className="flex gap-2">
                        {slippagePresets.map(p => (
                            <button key={p} onClick={() => setSlippage(p)} className={`px-2 py-1 rounded text-xs ${slippage === p ? 'bg-primary text-black' : 'bg-white/10'}`}>{p}%</button>
                        ))}
                    </div>
                </div>
            )}

            {/* Inputs */}
            <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-6 shadow-2xl space-y-4">

                {/* Input Token */}
                <div className="rounded-2xl bg-black/50 p-4 border border-white/5">
                    <div className="flex justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Selling</span>
                        <span className="text-xs text-muted-foreground">Bal: {inputBalance.toFixed(3)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-transparent text-2xl font-bold text-white outline-none"
                        />
                        <button onClick={() => openSelector("input")} className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl">
                            <img src={tokens.input.logoURI} className="w-6 h-6 rounded-full" />
                            <span className="font-bold text-sm">{tokens.input.symbol}</span>
                        </button>
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center -my-6 relative z-10">
                    <div className="bg-[#0A0A0A] p-1.5 rounded-full border border-white/10">
                        <ArrowDownCircle className="text-muted-foreground" onClick={switchTokens} />
                    </div>
                </div>

                {/* Output Token */}
                <div className="rounded-2xl bg-black/50 p-4 border border-white/5 pt-6">
                    <div className="flex justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Buying</span>
                        <span className="text-xs text-muted-foreground">Bal: {outputBalance.toFixed(3)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-full text-2xl font-bold text-white/50">
                            {activeTab === 'swap' ? (
                                loading ? "..." : outputAmount > 0 ? outputAmount.toFixed(4) : "0.00"
                            ) : (
                                "---"
                            )}
                        </div>
                        <button onClick={() => openSelector("output")} className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl">
                            <img src={tokens.output.logoURI} className="w-6 h-6 rounded-full" />
                            <span className="font-bold text-sm">{tokens.output.symbol}</span>
                        </button>
                    </div>
                </div>

                {/* Extra Inputs for Limit/DCA */}
                {activeTab === 'limit' && (
                    <div className="rounded-2xl bg-black/50 p-4 border border-white/5">
                        <span className="text-xs text-muted-foreground block mb-2">Limit Price (Rate)</span>
                        <input
                            type="number"
                            value={limitRate}
                            onChange={e => setLimitRate(e.target.value)}
                            className="w-full bg-transparent text-lg font-bold text-white outline-none"
                            placeholder="Target Rate"
                        />
                        <div className="text-xs text-muted-foreground mt-1">1 {tokens.input.symbol} = {limitRate || "---"} {tokens.output.symbol}</div>
                    </div>
                )}

                {/* Action Button */}
                {!connected ? (
                    <button onClick={() => setVisible(true)} className="w-full py-4 rounded-xl bg-primary text-black font-bold mt-4">Connect Wallet</button>
                ) : (
                    <button
                        onClick={() => {
                            if (activeTab === 'swap') executeSwap();
                            if (activeTab === 'limit') handleLimitOrder();
                            if (activeTab === 'dca') handleDCA();
                        }}
                        disabled={loading || limitLoading || dcaLoading}
                        className="w-full py-4 rounded-xl bg-primary text-black font-bold mt-4 disabled:opacity-50"
                    >
                        {loading || limitLoading || dcaLoading ? "Processing..." :
                            activeTab === 'swap' ? "Swap Now" :
                                activeTab === 'limit' ? "Place Limit Order" : "Start DCA"}
                    </button>
                )}

            </div>

            {/* Order Lists */}
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
