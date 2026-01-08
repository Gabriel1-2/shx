"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getWalletTransactions, SwapTransaction } from "@/lib/transactions";
import { ArrowRight, ExternalLink, Clock, TrendingUp, Loader2 } from "lucide-react";

export function TransactionHistory() {
    const { publicKey, connected } = useWallet();
    const [transactions, setTransactions] = useState<SwapTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (publicKey) {
            setLoading(true);
            getWalletTransactions(publicKey.toString(), 15).then(txs => {
                setTransactions(txs);
                setLoading(false);
            });
        } else {
            setTransactions([]);
            setLoading(false);
        }
    }, [publicKey]);

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    if (!connected) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={18} className="text-primary" />
                    <h3 className="text-lg font-bold text-white">Transaction History</h3>
                </div>
                <p className="text-sm text-muted-foreground text-center py-8">
                    Connect wallet to see your transactions
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={18} className="text-primary" />
                    <h3 className="text-lg font-bold text-white">Transaction History</h3>
                </div>
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-primary" size={24} />
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    <h3 className="text-sm font-bold text-white">Your Transactions</h3>
                </div>
                <span className="text-[10px] text-muted-foreground">{transactions.length} swaps</span>
            </div>

            {transactions.length === 0 ? (
                <div className="p-8 text-center">
                    <TrendingUp size={32} className="text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Your swaps will appear here</p>
                </div>
            ) : (
                <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                    {transactions.map((tx) => (
                        <div key={tx.id} className="px-4 py-3 hover:bg-white/5 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-white border border-white/10">
                                        {tx.inputToken.slice(0, 2)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <span className="font-bold text-white">
                                                {tx.inputAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                            </span>
                                            <span className="text-muted-foreground">{tx.inputToken}</span>
                                            <ArrowRight size={12} className="text-primary" />
                                            <span className="font-bold text-primary">
                                                {tx.outputAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                            </span>
                                            <span className="text-muted-foreground">{tx.outputToken}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                                            <span>{formatTime(tx.timestamp)}</span>
                                            <span>•</span>
                                            <span className="text-green-400">${tx.volumeUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                            <span>•</span>
                                            <span>Fee: ${tx.feePaid.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                                <a
                                    href={`https://solscan.io/tx/${tx.txSignature}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <ExternalLink size={14} className="text-muted-foreground" />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
