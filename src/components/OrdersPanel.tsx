"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2, ShieldCheck, ArrowRight, RefreshCw, XCircle } from "lucide-react";
import { APP_TOKENS } from "@/lib/constants";
import { useJupiterVaultAuth } from "@/hooks/useJupiterVaultAuth";

type OrderTab = "limit" | "dca";

interface LimitOrder {
    id?: string;
    orderPubkey?: string;
    ocoId?: string;
    inputMint: string;
    outputMint: string;
    triggerCondition?: string;
    triggerPriceUsd?: string | number;
    triggerPrice?: string | number;
    status?: string;
    orderState?: string;
    inputAmount?: string;
    inAmount?: string;
}

interface DCAOrder {
    publicKey?: string;
    orderAccount?: string;
    orderKey?: string;
    inputMint: string;
    outputMint: string;
    interval?: number;
    remainingOrders?: number;
    numberOfOrders?: number;
    inAmount?: string | number;
    params?: { time?: { numberOfOrders?: number; interval?: number; inAmount?: number } };
    status?: string;
    orderStatus?: string;
}

export default function OrdersPanel() {
    const { publicKey, connected, signTransaction, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const { setVisible } = useWalletModal();
    const { ensureAuth, getStoredJwt, authenticate, isAuthenticating } = useJupiterVaultAuth();

    const [activeTab, setActiveTab] = useState<OrderTab>("limit");
    const [jwt, setJwt] = useState<string | null>(null);
    const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);
    const [dcaOrders, setDcaOrders] = useState<DCAOrder[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const showMessage = (msg: string, type: "info" | "success" | "error" = "info") => {
        setStatusMessage(msg);
        setStatusType(type);
        setTimeout(() => setStatusMessage(null), 8000);
    };

    const getTokenSymbol = (mint: string) => {
        const token = APP_TOKENS.find((t) => t.address === mint);
        return token ? token.symbol : `${mint.slice(0, 4)}...`;
    };

    const fetchLimitOrders = useCallback(
        async (token: string) => {
            if (!publicKey) return;
            setIsLoading(true);
            try {
                const res = await fetch("/api/limit/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        wallet: publicKey.toString(),
                        jwt: token,
                        state: "open",
                    }),
                });
                const data = await res.json();
                if (!res.ok) {
                    if (res.status === 401) {
                        setJwt(null);
                        throw new Error("Session expired — re-authenticate");
                    }
                    throw new Error(data.error || "Failed to fetch orders");
                }
                setLimitOrders(data.orders || []);
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : "Unknown error";
                showMessage(msg, "error");
            } finally {
                setIsLoading(false);
            }
        },
        [publicKey]
    );

    const fetchDcaOrders = useCallback(async () => {
        if (!publicKey) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/dca/orders?user=${publicKey.toString()}&orderStatus=active`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch DCA orders");
            setDcaOrders(data.orders || []);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            showMessage(msg, "error");
        } finally {
            setIsLoading(false);
        }
    }, [publicKey]);

    // Restore JWT on mount
    useEffect(() => {
        const stored = getStoredJwt();
        if (stored) setJwt(stored);
    }, [getStoredJwt, publicKey]);

    useEffect(() => {
        if (activeTab === "limit" && jwt) {
            fetchLimitOrders(jwt);
            fetch("/api/limit/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: publicKey?.toString(), jwt }),
            }).catch(() => {});
        } else if (activeTab === "dca" && connected && publicKey) {
            fetchDcaOrders();
            fetch("/api/dca/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: publicKey.toString() }),
            }).catch(() => {});
        }
    }, [activeTab, connected, jwt, fetchLimitOrders, fetchDcaOrders, publicKey]);

    useEffect(() => {
        const onUpdate = () => {
            if (jwt) fetchLimitOrders(jwt);
            if (publicKey) fetchDcaOrders();
        };
        window.addEventListener("shx-orders-updated", onUpdate);
        return () => window.removeEventListener("shx-orders-updated", onUpdate);
    }, [jwt, publicKey, fetchLimitOrders, fetchDcaOrders]);

    const handleAuth = async () => {
        try {
            const token = await authenticate();
            setJwt(token);
            showMessage("✅ Authenticated", "success");
            fetchLimitOrders(token);
        } catch (e: unknown) {
            showMessage(e instanceof Error ? e.message : "Auth failed", "error");
        }
    };

    const cancelLimitOrder = async (orderId: string) => {
        if (!publicKey || !signTransaction) {
            showMessage("Wallet signing required to cancel and withdraw", "error");
            return;
        }
        setCancellingId(orderId);
        try {
            let token = jwt;
            if (!token) token = await ensureAuth();
            setJwt(token);

            setStatusMessage("Initiating cancel...");
            setStatusType("info");
            const initRes = await fetch("/api/limit/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "initiate",
                    wallet: publicKey.toString(),
                    jwt: token,
                    orderId,
                }),
            });
            const initData = await initRes.json();
            if (!initRes.ok) throw new Error(initData.error || "Cancel initiate failed");

            if (!initData.transaction || !initData.requestId) {
                // Some responses may cancel without withdraw tx
                showMessage("✅ Order cancelled", "success");
                fetchLimitOrders(token);
                return;
            }

            setStatusMessage("Sign withdrawal to reclaim funds...");
            const { VersionedTransaction } = await import("@solana/web3.js");
            const tx = VersionedTransaction.deserialize(
                Buffer.from(initData.transaction, "base64")
            );
            type ST = Parameters<typeof signTransaction>[0];
            const signed = await signTransaction(tx as ST);
            const signedTransaction = Buffer.from(signed.serialize()).toString("base64");

            setStatusMessage("Confirming cancellation...");
            const confirmRes = await fetch("/api/limit/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "confirm",
                    wallet: publicKey.toString(),
                    jwt: token,
                    orderId,
                    signedTransaction,
                    cancelRequestId: initData.requestId,
                }),
            });
            const confirmData = await confirmRes.json();
            if (!confirmRes.ok) throw new Error(confirmData.error || "Confirm cancel failed");

            showMessage("✅ Limit order cancelled — funds returned", "success");
            fetchLimitOrders(token);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            showMessage(msg, "error");
        } finally {
            setCancellingId(null);
        }
    };

    const cancelDcaOrder = async (orderAccount: string) => {
        if (!publicKey || (!signTransaction && !sendTransaction)) return;
        setCancellingId(orderAccount);
        try {
            setStatusMessage("Crafting cancel transaction...");
            setStatusType("info");

            const res = await fetch("/api/dca/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "cancel",
                    user: publicKey.toString(),
                    orderAccount,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to craft cancel tx");
            if (!data.transaction) throw new Error("No cancel transaction returned");

            setStatusMessage("Sign the cancellation...");
            const { VersionedTransaction } = await import("@solana/web3.js");
            const tx = VersionedTransaction.deserialize(Buffer.from(data.transaction, "base64"));

            if (signTransaction && data.requestId) {
                type ST = Parameters<typeof signTransaction>[0];
                const signed = await signTransaction(tx as ST);
                const signedTransaction = Buffer.from(signed.serialize()).toString("base64");
                const execRes = await fetch("/api/dca/cancel", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "execute",
                        user: publicKey.toString(),
                        signedTransaction,
                        requestId: data.requestId,
                    }),
                });
                if (!execRes.ok) {
                    // Fallback RPC
                    const signature = await sendTransaction!(tx, connection);
                    await connection.confirmTransaction(signature, "confirmed");
                }
            } else {
                const signature = await sendTransaction!(tx, connection);
                await connection.confirmTransaction(signature, "confirmed");
            }

            showMessage("✅ DCA cancelled — remaining funds returned", "success");
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
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                    <div className="relative flex items-center justify-center w-6 h-6 rounded bg-white/5 border border-white/10">
                        <RefreshCw size={12} className="text-white/70" />
                    </div>
                    <span className="font-bold text-sm tracking-wide text-white">ACTIVE ORDERS</span>
                </div>
                {connected && (
                    <button
                        type="button"
                        onClick={() => {
                            if (activeTab === "limit" && jwt) fetchLimitOrders(jwt);
                            else if (activeTab === "dca") fetchDcaOrders();
                        }}
                        className="text-[10px] text-muted-foreground hover:text-white flex items-center gap-1"
                    >
                        <RefreshCw size={10} /> Refresh
                    </button>
                )}
            </div>

            <div className="p-4 border-b border-white/5">
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <button
                        type="button"
                        onClick={() => setActiveTab("limit")}
                        className={`relative py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 ${
                            activeTab === "limit"
                                ? "bg-white/10 text-white shadow-sm"
                                : "text-muted-foreground hover:text-white/70"
                        }`}
                    >
                        Limit Orders
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("dca")}
                        className={`relative py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all duration-200 ${
                            activeTab === "dca"
                                ? "bg-white/10 text-white shadow-sm"
                                : "text-muted-foreground hover:text-white/70"
                        }`}
                    >
                        DCA Strategies
                    </button>
                </div>
            </div>

            <div className="p-4 md:p-5 flex-1 overflow-y-auto">
                {!connected ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                        <ShieldCheck size={48} className="text-white/10" />
                        <p className="text-muted-foreground text-sm">
                            Connect your wallet to manage active orders.
                        </p>
                        <button
                            type="button"
                            onClick={() => setVisible(true)}
                            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-black hover:opacity-90 transition-all"
                        >
                            Connect Wallet
                        </button>
                    </div>
                ) : activeTab === "limit" ? (
                    !jwt ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                            <ShieldCheck size={48} className="text-white/20" />
                            <p className="text-muted-foreground text-sm max-w-[280px]">
                                Sign once to authenticate with Jupiter Trigger vault and view
                                limit orders.
                            </p>
                            <button
                                type="button"
                                onClick={handleAuth}
                                disabled={isAuthenticating}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                {isAuthenticating ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" /> Authenticating...
                                    </>
                                ) : (
                                    "Authenticate Vault"
                                )}
                            </button>
                        </div>
                    ) : isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 size={24} className="text-white/50 animate-spin" />
                        </div>
                    ) : limitOrders.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12">
                            <p className="text-muted-foreground text-sm">No active limit orders.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {limitOrders.map((order) => {
                                const id = order.id || order.ocoId || order.orderPubkey || "";
                                return (
                                    <div
                                        key={id}
                                        className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span
                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        order.triggerCondition === "above"
                                                            ? "bg-red-500/20 text-red-400"
                                                            : "bg-green-500/20 text-green-400"
                                                    }`}
                                                >
                                                    {order.triggerCondition === "above"
                                                        ? "SELL"
                                                        : "BUY"}
                                                </span>
                                                <span className="text-sm font-bold text-white">
                                                    {getTokenSymbol(order.inputMint)}{" "}
                                                    <ArrowRight
                                                        size={12}
                                                        className="inline mx-1 text-white/50"
                                                    />{" "}
                                                    {getTokenSymbol(order.outputMint)}
                                                </span>
                                                {(order.orderState === "failed" ||
                                                    order.status === "failed") && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-red-500/20 text-red-500 uppercase">
                                                        Failed
                                                    </span>
                                                )}
                                                {(order.orderState === "pending_withdraw" ||
                                                    order.status === "pending_withdraw") && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-400 uppercase">
                                                        Pending withdraw
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Trigger{" "}
                                                <span className="text-white font-medium">
                                                    ${order.triggerPriceUsd ?? order.triggerPrice}
                                                </span>
                                                {(order.orderState || order.status) && (
                                                    <span className="ml-2 opacity-70">
                                                        · {order.orderState || order.status}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => cancelLimitOrder(id)}
                                            disabled={cancellingId === id || !id}
                                            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {cancellingId === id ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                                <XCircle size={14} />
                                            )}
                                            Cancel & Withdraw
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : isLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 size={24} className="text-white/50 animate-spin" />
                    </div>
                ) : dcaOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                        <p className="text-muted-foreground text-sm">No active DCA strategies.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {dcaOrders.map((dca) => {
                            const account =
                                dca.publicKey || dca.orderAccount || dca.orderKey || "";
                            const interval =
                                dca.interval || dca.params?.time?.interval || null;
                            const remaining =
                                dca.remainingOrders ??
                                dca.params?.time?.numberOfOrders ??
                                dca.numberOfOrders ??
                                "?";
                            return (
                                <div
                                    key={account}
                                    className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                                >
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                                                DCA
                                            </span>
                                            <span className="text-sm font-bold text-white">
                                                {getTokenSymbol(dca.inputMint)}{" "}
                                                <ArrowRight
                                                    size={12}
                                                    className="inline mx-1 text-white/50"
                                                />{" "}
                                                {getTokenSymbol(dca.outputMint)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Interval:{" "}
                                            <span className="text-white font-medium">
                                                {interval
                                                    ? interval >= 86400
                                                        ? `${interval / 86400}d`
                                                        : `${interval}s`
                                                    : "—"}
                                            </span>{" "}
                                            · Remaining:{" "}
                                            <span className="text-white font-medium">
                                                {remaining}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => cancelDcaOrder(account)}
                                        disabled={cancellingId === account || !account}
                                        className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {cancellingId === account ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <XCircle size={14} />
                                        )}
                                        Cancel
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {statusMessage && (
                <div
                    className={`m-4 px-4 py-3 rounded-xl border text-[12px] font-medium transition-all ${
                        statusType === "error"
                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                            : statusType === "success"
                              ? "bg-green-500/10 border-green-500/20 text-green-400"
                              : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"
                    }`}
                >
                    {statusMessage}
                </div>
            )}
        </div>
    );
}
