import type { Metadata } from "next";
import Link from "next/link";
import { REFERRAL_CONFIG } from "@/lib/referralConfig";
import { PartnersOnePager } from "@/components/PartnersOnePager";

export const metadata: Metadata = {
    title: "SHX Partner Program | Earn USDC Affiliates",
    description:
        "SHX Exchange partner one-pager: 25–35% of platform fees from real Solana traders, paid in USDC. Non-custodial. Jupiter Ultra.",
    openGraph: {
        title: "SHX Partner Program — Paid in USDC",
        description:
            "Share your link. Earn 25–35% of fees after real volume. Auto USDC. Not points.",
        url: "https://shx.exchange/partners",
    },
};

export default function PartnersPage() {
    return (
        <main className="min-h-screen bg-background relative overflow-x-hidden">
            <div className="absolute inset-0 pointer-events-none overflow-hidden print:hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[35%] bg-emerald-500/10 blur-[100px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto px-3 md:px-6 py-4 md:py-10 pb-28 md:pb-12">
                {/* Screen-only chrome */}
                <div className="flex items-center justify-between mb-4 print:hidden">
                    <Link
                        href="/"
                        className="text-xs font-bold text-muted-foreground hover:text-white"
                    >
                        ← SHX Exchange
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/referrals"
                            className="text-[11px] font-bold text-primary hover:underline"
                        >
                            Open app referrals
                        </Link>
                        <button
                            type="button"
                            className="text-[11px] font-black px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10"
                            id="print-partners"
                        >
                            Print / PDF
                        </button>
                    </div>
                </div>

                <PartnersOnePager
                    headline={REFERRAL_CONFIG.headline}
                    subhead={REFERRAL_CONFIG.subhead}
                    minVolume={REFERRAL_CONFIG.minQualifyingVolumeUsd}
                    minTrades={REFERRAL_CONFIG.minQualifyingTrades}
                    minPayout={REFERRAL_CONFIG.minPayoutUsd}
                    baseShare={Math.round(REFERRAL_CONFIG.baseL1FeeShare * 100)}
                    maxShare={Math.round(
                        REFERRAL_CONFIG.affiliateTiers[
                            REFERRAL_CONFIG.affiliateTiers.length - 1
                        ].feeShare * 100
                    )}
                    cashback={Math.round(
                        REFERRAL_CONFIG.refereeCashbackShare * 100
                    )}
                    l2Share={Math.round(REFERRAL_CONFIG.l2FeeShare * 100)}
                    tiers={REFERRAL_CONFIG.affiliateTiers.map((t) => ({
                        label: t.label,
                        minRefs: t.minRefs,
                        share: Math.round(t.feeShare * 100),
                    }))}
                />

                <p className="mt-6 text-center text-[10px] text-muted-foreground print:hidden">
                    Share this page:{" "}
                    <span className="text-primary font-mono">
                        shx.exchange/partners
                    </span>
                </p>
            </div>
        </main>
    );
}
