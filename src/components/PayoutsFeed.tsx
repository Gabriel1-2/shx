"use client";

import { useEffect, useState } from "react";
import { Banknote, ExternalLink } from "lucide-react";

interface Payout {
    id: string;
    wallet: string;
    amountUsd: number;
    signature?: string;
    status: string;
    completedAt?: string;
    createdAt?: string;
}

export function PayoutsFeed() {
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [totalPaid, setTotalPaid] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/stats/payouts")
            .then((r) => r.json())
            .then((d) => {
                setPayouts(d.payouts || []);
                setTotalPaid(d.totalPaidUsd || 0);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Banknote size={14} className="text-green-400" />
                    <h3 className="text-sm font-bold text-white">USDC Payouts</h3>
                </div>
                <span className="text-[10px] font-mono text-green-400 font-bold">
                    ${totalPaid.toFixed(2)} paid
                </span>
            </div>
            <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
                {loading && (
                    <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
                )}
                {!loading && payouts.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                        First auto-payouts appear here after claimable ≥ $5.
                    </p>
                )}
                {payouts.map((p) => (
                    <div
                        key={p.id}
                        className="flex items-center justify-between text-[11px] px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/5"
                    >
                        <div>
                            <span className="font-mono text-muted-foreground">
                                {p.wallet.length > 12
                                    ? `${p.wallet.slice(0, 4)}…${p.wallet.slice(-4)}`
                                    : p.wallet}
                            </span>
                            <span className="ml-2 text-[9px] uppercase text-green-500/80">
                                {p.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-green-400 font-mono">
                                ${Number(p.amountUsd || 0).toFixed(2)}
                            </span>
                            {p.signature && (
                                <a
                                    href={`https://solscan.io/tx/${p.signature}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-white"
                                >
                                    <ExternalLink size={11} />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
