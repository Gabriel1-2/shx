import { useEffect } from "react";
import { useDCA } from "@/hooks/useDCA";
import { Loader2, Trash2, Repeat, ArrowRight } from "lucide-react";

export function ActiveDCAs() {
    const { activeDCAs, loading, fetchActiveDCAs, closeDCA } = useDCA();

    useEffect(() => {
        fetchActiveDCAs();
        const interval = setInterval(fetchActiveDCAs, 20000); // Poll every 20s
        return () => clearInterval(interval);
    }, [fetchActiveDCAs]);

    if (loading && activeDCAs.length === 0) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-primary" />
            </div>
        );
    }

    if (activeDCAs.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground border border-white/5 rounded-xl bg-black/40">
                <p>No active DCA strategies.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Repeat size={14} className="text-primary" />
                Active Strategies
            </h3>

            <div className="grid gap-2">
                {activeDCAs.map((dca: any, idx) => (
                    <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-lg hover:border-primary/30 transition-colors"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                                <span>{dca.account.inputMint.slice(0, 4)}...</span>
                                <ArrowRight size={12} className="text-muted-foreground" />
                                <span>{dca.account.outputMint.slice(0, 4)}...</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {dca.account.inAmountPerCycle} / {(Number(dca.account.cycleFrequency) / 60).toFixed(0)}m
                            </div>
                        </div>

                        <button
                            onClick={() => closeDCA(dca.publicKey)}
                            disabled={loading}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors"
                            title="Close Strategy"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
