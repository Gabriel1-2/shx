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
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
            <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-md"
                aria-label="Dismiss"
                onClick={close}
            />
            <div
                className="relative w-full max-w-md sm:mx-4 rounded-t-[1.75rem] sm:rounded-2xl border border-primary/30 border-b-0 sm:border-b bg-gradient-to-b from-[#121212] to-black shadow-2xl shadow-primary/15 overflow-hidden animate-fadeIn pb-[env(safe-area-inset-bottom)]"
                role="dialog"
                aria-modal="true"
            >
                {/* Grab handle (mobile) */}
                <div className="sm:hidden flex justify-center pt-2.5 pb-1">
                    <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>

                <div className="flex justify-between items-center px-4 py-2.5 sm:py-3 border-b border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                        Welcome · {step + 1}/3
                    </span>
                    <button
                        type="button"
                        onClick={close}
                        className="p-2 -mr-1 rounded-xl text-muted-foreground active:bg-white/10 active:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 sm:p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-4 shadow-[0_0_24px_rgba(34,197,94,0.2)]">
                        <s.icon className="text-primary" size={26} />
                    </div>
                    <h2 className="text-xl font-black text-white mb-2 tracking-tight">
                        {s.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6 px-1">
                        {s.body}
                    </p>
                    <button
                        type="button"
                        onClick={s.action}
                        className="w-full min-h-[48px] py-3.5 rounded-2xl bg-gradient-to-r from-primary to-lime-400 text-black font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_8px_28px_rgba(34,197,94,0.35)]"
                    >
                        {s.cta} <ArrowRight size={16} />
                    </button>
                    {step === 2 && (
                        <Link
                            href="/pro"
                            onClick={close}
                            className="block mt-3 py-2 text-xs text-muted-foreground active:text-white"
                        >
                            Or open Pro desk →
                        </Link>
                    )}
                </div>

                <div className="flex justify-center gap-1.5 pb-5">
                    {steps.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setStep(i)}
                            className={`h-1.5 rounded-full transition-all ${
                                i === step ? "w-7 bg-primary" : "w-1.5 bg-white/20"
                            }`}
                            aria-label={`Step ${i + 1}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
