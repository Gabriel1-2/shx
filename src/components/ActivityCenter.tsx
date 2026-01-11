import { useState } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { OpenOrders } from "@/components/OpenOrders";
import { ActiveDCAs } from "@/components/ActiveDCAs";
import { TransactionHistory } from "@/components/TransactionHistory";
import { Wallet, List, History, Loader2, ArrowRight } from "lucide-react";

export function ActivityCenter() {
    const [activeTab, setActiveTab] = useState<"portfolio" | "orders" | "history">("portfolio");
    const { portfolio, totalValue, loading: portfolioLoading, refresh } = usePortfolio();

    const tabs = [
        { id: "portfolio", label: "Portfolio", icon: Wallet },
        { id: "orders", label: "Orders", icon: List },
        { id: "history", label: "History", icon: History },
    ] as const;

    return (
        <div className="w-full max-w-md mx-auto mt-6">
            {/* Tabs */}
            <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 mb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
                                ? "bg-white/10 text-white shadow-sm"
                                : "text-muted-foreground hover:text-white"
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[300px] animate-fadeIn">
                {activeTab === "portfolio" && (
                    <div className="space-y-4">
                        {/* Total Value */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-neutral-900 to-black border border-white/10">
                            <span className="text-sm text-muted-foreground font-medium">Net Worth</span>
                            <div className="flex items-end gap-2 mt-1">
                                <h2 className="text-3xl font-bold text-white">
                                    ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </h2>
                                {portfolioLoading && <Loader2 size={18} className="animate-spin text-primary mb-1.5" />}
                            </div>
                        </div>

                        {/* Asset List */}
                        <div className="space-y-2">
                            {portfolio.length === 0 && !portfolioLoading ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    No assets found.
                                </div>
                            ) : (
                                portfolio.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            {item.logoURI ? (
                                                <img src={item.logoURI} alt={item.symbol} className="w-10 h-10 rounded-full bg-black" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-white">
                                                    {item.symbol.slice(0, 2)}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-bold text-white">{item.symbol}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.balance.toLocaleString()} {item.symbol}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-white">
                                                ${item.valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                ${item.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "orders" && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Limit Orders</h3>
                            <OpenOrders />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">DCA Strategies</h3>
                            <ActiveDCAs />
                        </div>
                    </div>
                )}

                {activeTab === "history" && (
                    <TransactionHistory />
                )}
            </div>
        </div>
    );
}
