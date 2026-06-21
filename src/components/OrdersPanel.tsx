"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2, ShieldCheck, ArrowRight, RefreshCw, XCircle } from "lucide-react";
import bs58 from "bs58";
import { APP_TOKENS } from "@/lib/constants";

type OrderTab = "limit" | "dca";

interface LimitOrder {
    id?: string;
    orderPubkey?: string;
    inputMint: string;
    outputMint: string;
    triggerCondition: string;
    triggerPriceUsd?: string;
    triggerPrice?: string;
    status?: string;
    orderState?: string;
}

interface DCAOrder {
    publicKey?: string;
    orderAccount?: string;
    inputMint: string;
    outputMint: string;
    interval?: number;
    remainingOrders?: number;
    params?: {
        time?: {
            numberOfOrders?: number;
        }
    }
}

export default function OrdersPanel() {
    const { publicKey, connected, signMessage, signTransaction, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const { setVisible } = useWalletModal();

    const [activeTab, setActiveTab] = useState<OrderTab>("limit");
    
    // Auth State (Limit)
    const [jwt, setJwt] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    
    // Orders State
    const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);
    const [dcaOrders, setDcaOrders] = useState<DCAOrder[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // UI State
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    // Helpers
    const showMessage = (msg: string, type: "info" | "success" | "error" = "info") => {
        setStatusMessage(msg);
        setStatusType(type);
        setTimeout(() => setStatusMessage(null), 8000);
    };

    const getTokenSymbol = (mint: string) => {
        const token = APP_TOKENS.find(t => t.address === mint);
        return token ? token.symbol : `${mint.slice(0, 4)}...`;
    };

    // --- AUTHENTICATE VAULT (For Limit Orders) ---
    const authenticateVault = async () => {
        if (!connected || !publicKey || !signMessage) {
            showMessage("Wallet connection or signing not supported", "error");
            return;
        }

        setIsAuthenticating(true);
        setStatusMessage("Requesting authentication challenge...");
        setStatusType("info");

        try {
            const challengeRes = await fetch("/api/limit/create", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "request-challenge", wallet: publicKey.toString() })
            });
            const challengeData = await challengeRes.json();
            if (!challengeRes.ok) throw new Error(challengeData.error || "Failed challenge");

            setStatusMessage("Please sign the authentication message...");
            const encodedMessage = new TextEncoder().encode(challengeData.challenge);
            const signature = await signMessage(encodedMessage);
            const base58Sig = bs58.encode(signature);

            setStatusMessage("Verifying signature...");
            const verifyRes = await fetch("/api/limit/create", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "verify-challenge", wallet: publicKey.toString(), signature: base58Sig })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Failed verify");

            setJwt(verifyData.token);
            try { localStorage.setItem("shx_jupiter_jwt", verifyData.token); } catch (_e) {}
            showMessage("✅ Authenticated successfully", "success");
            fetchLimitOrders(verifyData.token);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            console.error("[Auth]", error);
            showMessage(`Authentication Failed: ${msg}`, "error");
        } finally {
            setIsAuthenticating(false);
        }
    };

    // --- FETCH LIMIT ORDERS ---
    const fetchLimitOrders = useCallback(async (token: string) => {
        if (!publicKey) return;
        setIsLoading(true);
        try {
            const res = await fetch("/api/limit/orders", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: publicKey.toString(), jwt: token })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch orders");
            
            // Filter out closed/past orders just in case
            const openOrders = (data.orders || data.data || []).filter((o: LimitOrder) => o.status === "open" || o.status === "active" || o.orderState === "active" || o.orderState === "failed");
            setLimitOrders(openOrders);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            showMessage(msg, "error");
        } finally {
            setIsLoading(false);
        }
    }, [publicKey]);

    // --- FETCH DCA ORDERS ---
    const fetchDcaOrders = useCallback(async () => {
        if (!publicKey) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/dca/orders?user=${publicKey.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch DCA orders");
            
            setDcaOrders(data.orders || data.data || data.all || []);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            showMessage(msg, "error");
        } finally {
            setIsLoading(false);
        }
    }, [publicKey]);

    // Initial Load / Tab Switch
    useEffect(() => {
        if (activeTab === "limit" && jwt) {
            fetchLimitOrders(jwt);
        } else if (activeTab === "dca" && connected) {
            fetchDcaOrders();
        }
    }, [activeTab, connected, jwt, fetchLimitOrders, fetchDcaOrders]);

    // --- CANCEL LIMIT ORDER ---
    const cancelLimitOrder = async (orderId: string) => {
        if (!jwt || !publicKey) return;
        setCancellingId(orderId);
        try {
            const res = await fetch("/api/limit/cancel", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: publicKey.toString(), jwt, orderId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to cancel order");

            showMessage("✅ Limit order cancelled successfully", "success");
            fetchLimitOrders(jwt);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            showMessage(msg, "error");
        } finally {
            setCancellingId(null);
        }
    };

    // --- CANCEL DCA ORDER ---
    const cancelDcaOrder = async (orderAccount: string) => {
        if (!publicKey || !signTransaction) return;
        setCancellingId(orderAccount);
        try {
            setStatusMessage("Crafting cancel transaction...");
            setStatusType("info");

            const res = await fetch("/api/dca/cancel", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user: publicKey.toString(), orderAccount })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to craft cancel tx");

            setStatusMessage("Please sign the cancellation transaction...");
            
            const { VersionedTransaction } = await import('@solana/web3.js');
            const txBuffer = Buffer.from(data.transaction, "base64");
            const tx = VersionedTransaction.deserialize(txBuffer);
            
            const signature = await sendTransaction(tx, connection);
            
            setStatusMessage("Confirming cancellation on-chain...");
            await connection.confirmTransaction(signature, 'confirmed');

            showMessage("✅ DCA strategy cancelled successfully", "success");
            fetchDcaOrders();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            showMessage(msg, "error");
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <div className="w-full rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl shadow-black/50 overflow-hidden min-h-[400px] flex flex-col">
            {/* ── Header ───────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center w-6 h-6 rounded bg-white/5 border border-white/10">
                        <RefreshCw size={12} className="text-white/70" />
                    </div>
                    <span className="font-bold text-sm tracking-wide text-white">
                        ACTIVE ORDERS
                    </span>
                </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────── */}
            <div className="p-4 border-b border-white/5">
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <button
                        onClick={() => setActiveTab("limit")}
                        className={`relative py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 ${activeTab === "limit" ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white/70"}`}
                    >
                        Limit Orders
                    </button>
                    <button
                        onClick={() => setActiveTab("dca")}
                        className={`relative py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 ${activeTab === "dca" ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white/70"}`}
                    >
                        DCA Strategies
                    </button>
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────── */}
            <div className="p-4 md:p-5 flex-1 overflow-y-auto">
                {!connected ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                        <ShieldCheck size={48} className="text-white/10" />
                        <p className="text-muted-foreground text-sm">Connect your wallet to manage your active orders.</p>
                        <button onClick={() => setVisible(true)} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-black hover:opacity-90 transition-all">
                            Connect Wallet
                        </button>
                    </div>
                ) : activeTab === "limit" ? (
                    // LIMIT ORDERS VIEW
                    !jwt ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                            <ShieldCheck size={48} className="text-white/20" />
                            <p className="text-muted-foreground text-sm max-w-[250px]">
                                Jupiter V2 requires Vault authentication to view your limit orders.
                            </p>
                            <button 
                                onClick={authenticateVault} 
                                disabled={isAuthenticating}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                {isAuthenticating ? <><Loader2 size={16} className="animate-spin" /> Authenticating...</> : "Authenticate Vault"}
                            </button>
                        </div>
                    ) : isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 size={24} className="text-white/50 animate-spin" />
                        </div>
                    ) : limitOrders.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12">
                            <p className="text-muted-foreground text-sm">You have no active Limit Orders.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {limitOrders.map(order => {
                                return (
                                    <div key={order.id || order.orderPubkey} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.triggerCondition === "above" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                                                    {order.triggerCondition === "above" ? "SELL" : "BUY"}
                                                </span>
                                                <span className="text-sm font-bold text-white">
                                                    {getTokenSymbol(order.inputMint)} <ArrowRight size={12} className="inline mx-1 text-white/50" /> {getTokenSymbol(order.outputMint)}
                                                </span>
                                                {order.orderState === "failed" && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-red-500/20 text-red-500 uppercase tracking-wider ml-2">
                                                        FAILED (No SOL for rent?)
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Trigger at <span className="text-white font-medium">${order.triggerPriceUsd || order.triggerPrice}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => cancelLimitOrder(order.id || order.orderPubkey || "")}
                                            disabled={cancellingId === (order.id || order.orderPubkey)}
                                            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {cancellingId === (order.id || order.orderPubkey) ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={14} />}
                                            Cancel
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )
                ) : (
                    // DCA ORDERS VIEW
                    isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 size={24} className="text-white/50 animate-spin" />
                        </div>
                    ) : dcaOrders.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12">
                            <p className="text-muted-foreground text-sm">You have no active DCA Strategies.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {dcaOrders.map((dca) => {
                                const account = dca.publicKey || dca.orderAccount || "";
                                return (
                                    <div key={account} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                                                    DCA
                                                </span>
                                                <span className="text-sm font-bold text-white">
                                                    {getTokenSymbol(dca.inputMint)} <ArrowRight size={12} className="inline mx-1 text-white/50" /> {getTokenSymbol(dca.outputMint)}
                                                </span>
                                                {(dca.status === "failed" || dca.orderStatus === "failed") && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-red-500/20 text-red-500 uppercase tracking-wider ml-2">
                                                        FAILED (No SOL for rent?)
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Interval: <span className="text-white font-medium">{dca.interval || "Custom"}s</span> • Remaining: <span className="text-white font-medium">{dca.remainingOrders || dca.params?.time?.numberOfOrders || "?"} orders</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => cancelDcaOrder(account)}
                                            disabled={cancellingId === account}
                                            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {cancellingId === account ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={14} />}
                                            Cancel
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )
                )}
            </div>

            {/* ── Status Message ───────────────────────── */}
            {statusMessage && (
                <div className={`m-4 px-4 py-3 rounded-xl border text-[12px] font-medium transition-all ${statusType === "error" ? "bg-red-500/10 border-red-500/20 text-red-400" : statusType === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"}`}>
                    {statusMessage}
                </div>
            )}
        </div>
    );
}
