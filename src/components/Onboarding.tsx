"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { X, Zap, Gift, Layers, ArrowRight } from "lucide-react";
import Link from "next/link";

const KEY = "shx_onboarded_v2";

export function Onboarding() {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);
    const { connected } = useWallet();
    const { setVisible } = useWalletModal();

    useEffect(() => {
        try {
            if (!localStorage.getItem(KEY)) setOpen(true);
        } catch {
            /* ignore */
        }
    }, []);

    const close = () => {
        try {
            localStorage.setItem(KEY, "1");
        } catch {
            /* ignore */
        }
        setOpen(false);
    };

    if (!open) return null;

    const steps = [
        {
            icon: Zap,
            title: "Best routes. Your keys.",
            body: "SHX routes through Jupiter Ultra — deepest Solana liquidity. Non-custodial. No KYC.",
            cta: "Next",
            action: () => setStep(1),
        },
        {
            icon: Layers,
            title: "Hold SHX. Pay less.",
            body: "Fees drop from 0.65% to 0.50% as you hold more SHX. Buying SHX is always 0% platform fee.",
            cta: "Next",
            action: () => setStep(2),
        },
        {
            icon: Gift,
            title: "Invite. Earn USDC.",
            body: "Share your link. After friends trade $100+, you earn 25–35% of fees — auto-paid in USDC at $5.",
            cta: connected ? "Start trading" : "Connect wallet",
            action: () => {
                close();
                if (!connected) setVisible(true);
            },
        },
    ];

    const s = steps[step];

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-gradient-to-b from-[#0c0c0c] to-black shadow-2xl shadow-primary/10 overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3 border-b border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                        Welcome to SHX · {step + 1}/3
                    </span>
                    <button type="button" onClick={close} className="p-1 text-muted-foreground hover:text-white">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                        <s.icon className="text-primary" size={26} />
                    </div>
                    <h2 className="text-xl font-black text-white mb-2">{s.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">{s.body}</p>
                    <button
                        type="button"
                        onClick={s.action}
                        className="w-full py-3 rounded-xl bg-primary text-black font-black text-sm flex items-center justify-center gap-2 hover:opacity-90"
                    >
                        {s.cta} <ArrowRight size={14} />
                    </button>
                    {step === 2 && (
                        <Link
                            href="/pro"
                            onClick={close}
                            className="block mt-3 text-xs text-muted-foreground hover:text-white"
                        >
                            Or open Pro desk →
                        </Link>
                    )}
                </div>
                <div className="flex justify-center gap-1.5 pb-4">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-all ${
                                i === step ? "w-6 bg-primary" : "w-1.5 bg-white/20"
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
