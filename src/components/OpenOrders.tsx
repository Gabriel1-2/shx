import { useEffect } from "react";
import { useLimitOrders } from "@/hooks/useLimitOrders";
import { Loader2, Trash2, Clock, ArrowRight } from "lucide-react";

export function OpenOrders() {
    const { openOrders, loading, fetchOpenOrders, cancelLimitOrder } = useLimitOrders();

    useEffect(() => {
        fetchOpenOrders();
        const interval = setInterval(fetchOpenOrders, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [fetchOpenOrders]);

    if (loading && openOrders.length === 0) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-primary" />
            </div>
        );
    }

    if (openOrders.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground border border-white/5 rounded-xl bg-black/40">
                <p>No open limit orders.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock size={14} className="text-primary" />
                Open Orders
            </h3>

            <div className="grid gap-2">
                {openOrders.map((order: any, idx) => (
                    <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-lg hover:border-primary/30 transition-colors"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                <span>{order.account.inputMint.slice(0, 4)}...</span>
                                <ArrowRight size={12} className="text-muted-foreground" />
                                <span>{order.account.outputMint.slice(0, 4)}...</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                In: {order.account.inAmount} • Out: {order.account.outAmount}
                            </div>
                        </div>

                        <button
                            onClick={() => cancelLimitOrder(order.publicKey)}
                            disabled={loading}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors"
                            title="Cancel Order"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
