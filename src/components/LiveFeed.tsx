"use client";

import { useState, useEffect } from "react";
import { getRecentTransactions, SwapTransaction } from "@/lib/transactions";
import { ArrowRight, ExternalLink } from "lucide-react";

export function LiveFeed() {
    const [transactions, setTransactions] = useState<SwapTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            const txs = await getRecentTransactions(8);
            setTransactions(txs);
            setLoading(false);
        };

        fetchTransactions();
        // Poll every 15 seconds
        const interval = setInterval(fetchTransactions, 15000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const shortenWallet = (wallet: string) =>
        `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-4">
                <h3 className="text-sm font-bold text-white mb-4">Live Activity</h3>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                            <div className="w-8 h-8 rounded-full bg-white/10"></div>
                            <div className="flex-1 space-y-1">
                                <div className="w-32 h-3 bg-white/10 rounded"></div>
                                <div className="w-20 h-2 bg-white/5 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Live Activity
                </h3>
                <p className="text-xs text-muted-foreground text-center py-4">
                    No swaps yet. Be the first! 🚀
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Live Activity
                </h3>
                <span className="text-[10px] text-muted-foreground">Real swaps</span>
            </div>

            <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
                {transactions.map((tx) => (
                    <div key={tx.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
                            {tx.inputToken.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-bold text-white">{tx.inputAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                <span className="text-muted-foreground">{tx.inputToken}</span>
                                <ArrowRight size={10} className="text-primary" />
                                <span className="font-bold text-primary">{tx.outputAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                <span className="text-muted-foreground">{tx.outputToken}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                <span className="font-mono">{shortenWallet(tx.wallet)}</span>
                                <span>•</span>
                                <span>{formatTime(tx.timestamp)}</span>
                            </div>
                        </div>
                        <a
                            href={`https://solscan.io/tx/${tx.txSignature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ExternalLink size={12} className="text-muted-foreground" />
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
}
