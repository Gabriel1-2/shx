"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, RefreshCw } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";

export function PortfolioCard() {
    const { connected } = useWallet();
    const { setVisible } = useWalletModal();
    const { portfolio, totalValue, loading, refresh } = usePortfolio();

    if (!connected) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-center">
                <Wallet className="mx-auto text-muted-foreground mb-2" size={20} />
                <p className="text-xs text-muted-foreground mb-3">
                    Connect to view portfolio balances
                </p>
                <button
                    type="button"
                    onClick={() => setVisible(true)}
                    className="px-4 py-2 rounded-lg bg-primary text-black text-xs font-black"
                >
                    Connect Wallet
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wallet size={14} className="text-primary" />
                    <h3 className="text-sm font-bold text-white">Portfolio</h3>
                </div>
                <button
                    type="button"
                    onClick={() => refresh()}
                    className="p-1 rounded hover:bg-white/10 text-muted-foreground"
                >
                    <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
            </div>
            <div className="p-4">
                <div className="text-[10px] text-muted-foreground uppercase mb-1">Total value</div>
                <div className="text-2xl font-black text-white font-mono mb-4">
                    {loading ? "…" : `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {portfolio.slice(0, 12).map((item) => (
                        <div
                            key={item.mint}
                            className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-white/[0.03]"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {item.logoURI ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.logoURI}
                                        alt=""
                                        className="w-5 h-5 rounded-full"
                                    />
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-white/10" />
                                )}
                                <span className="font-bold text-white truncate">
                                    {item.symbol}
                                </span>
                            </div>
                            <div className="text-right font-mono">
                                <div className="text-white">
                                    {item.balance < 0.01
                                        ? item.balance.toExponential(2)
                                        : item.balance.toLocaleString(undefined, {
                                              maximumFractionDigits: 4,
                                          })}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    ${item.valueUSD.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    ))}
                    {portfolio.length === 0 && !loading && (
                        <p className="text-xs text-muted-foreground text-center py-3">
                            No balances detected
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
