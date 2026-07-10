"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Gift, X, Sparkles } from "lucide-react";

/**
 * Shows when user lands with ?ref=CODE — push them to connect & claim bonuses.
 */
export function ReferralBanner() {
    const params = useSearchParams();
    const { connected } = useWallet();
    const { setVisible } = useWalletModal();
    const [code, setCode] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const [claimed, setClaimed] = useState(false);

    useEffect(() => {
        const ref = params.get("ref");
        if (ref) {
            const c = ref.toUpperCase();
            setCode(c);
            try {
                localStorage.setItem("shx_referral_code", c);
            } catch {
                /* ignore */
            }
        } else {
            try {
                const stored = localStorage.getItem("shx_referral_code");
                if (stored && !connected) setCode(stored);
            } catch {
                /* ignore */
            }
        }
    }, [params, connected]);

    useEffect(() => {
        if (connected) {
            // Hook registers automatically; hide after short delay
            const t = setTimeout(() => setClaimed(true), 2500);
            return () => clearTimeout(t);
        }
    }, [connected]);

    if (!code || dismissed || (connected && claimed)) return null;

    return (
        <div className="relative z-40 border-b border-primary/30 bg-gradient-to-r from-primary/20 via-emerald-500/15 to-purple-500/20 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                        <Gift size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs md:text-sm font-black text-white flex items-center gap-1.5">
                            <Sparkles size={12} className="text-primary shrink-0" />
                            Invite active — claim your bonuses
                        </div>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                            Code <span className="text-primary font-mono font-bold">{code}</span>
                            {" · "}+250 XP on connect · cashback after $100+ volume
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!connected && (
                        <button
                            type="button"
                            onClick={() => setVisible(true)}
                            className="px-3 py-1.5 rounded-lg bg-primary text-black text-xs font-black hover:opacity-90"
                        >
                            Connect & Claim
                        </button>
                    )}
                    {connected && (
                        <span className="text-[10px] font-bold text-green-400">Linking…</span>
                    )}
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        className="p-1 rounded hover:bg-white/10 text-muted-foreground"
                        aria-label="Dismiss"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
