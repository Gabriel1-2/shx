"use client";

import { useEffect } from "react";
import {
    Gift,
    Shield,
    Zap,
    DollarSign,
    Users,
    Link2,
    Check,
    Rocket,
    Wallet,
} from "lucide-react";

interface Tier {
    label: string;
    minRefs: number;
    share: number;
}

interface Props {
    headline: string;
    subhead: string;
    minVolume: number;
    minTrades: number;
    minPayout: number;
    baseShare: number;
    maxShare: number;
    cashback: number;
    l2Share: number;
    tiers: Tier[];
}

/**
 * Printable KOL / partner one-pager. Screen + PDF via window.print().
 */
export function PartnersOnePager({
    headline,
    subhead,
    minVolume,
    minTrades,
    minPayout,
    baseShare,
    maxShare,
    cashback,
    l2Share,
    tiers,
}: Props) {
    useEffect(() => {
        const btn = document.getElementById("print-partners");
        if (!btn) return;
        const onClick = () => window.print();
        btn.addEventListener("click", onClick);
        return () => btn.removeEventListener("click", onClick);
    }, []);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText("https://shx.exchange/partners");
            alert("Copied: https://shx.exchange/partners");
        } catch {
            /* ignore */
        }
    };

    return (
        <article className="partners-sheet rounded-2xl md:rounded-3xl border border-white/10 bg-gradient-to-b from-[#0d0d0d] via-black to-[#080808] overflow-hidden shadow-[0_0_60px_rgba(34,197,94,0.12)] print:shadow-none print:border-black/20">
            {/* Header band */}
            <header className="relative px-5 md:px-8 pt-6 md:pt-8 pb-5 border-b border-white/10 bg-gradient-to-r from-primary/15 via-emerald-500/10 to-transparent">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-lime-400">
                                SHX
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/90 border border-primary/30 rounded-full px-2 py-0.5">
                                Partner program
                            </span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight leading-snug max-w-xl">
                            {headline}
                        </h1>
                        <p className="mt-2 text-xs md:text-sm text-muted-foreground max-w-lg leading-relaxed">
                            {subhead}
                        </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                            Non-custodial
                        </span>
                        <span className="text-xs font-mono text-white/80">
                            shx.exchange
                        </span>
                    </div>
                </div>
            </header>

            <div className="px-5 md:px-8 py-5 md:py-6 space-y-5">
                {/* What is SHX */}
                <section>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
                        What you&apos;re promoting
                    </h2>
                    <p className="text-xs md:text-sm text-white/85 leading-relaxed">
                        <strong className="text-white">Shulevitz Exchange (SHX)</strong> is a
                        non-custodial Solana trading desk:{" "}
                        <strong className="text-primary">Jupiter Ultra</strong> routes, fee tiers
                        for SHX holders, Limit &amp; DCA, live proof, and an agent/MCP API. Users
                        keep their keys. No KYC deposit funnel.
                    </p>
                </section>

                {/* Key numbers */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                        {
                            icon: DollarSign,
                            label: "Your cut",
                            value: `${baseShare}–${maxShare}%`,
                            sub: "of platform fees",
                        },
                        {
                            icon: Wallet,
                            label: "Paid in",
                            value: "USDC",
                            sub: `auto from $${minPayout}`,
                        },
                        {
                            icon: Users,
                            label: "Qualify",
                            value: `$${minVolume}+`,
                            sub: `${minTrades}+ trades`,
                        },
                        {
                            icon: Gift,
                            label: "Invitee",
                            value: `${cashback}%`,
                            sub: "fee cashback",
                        },
                    ].map((c) => (
                        <div
                            key={c.label}
                            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                        >
                            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                                <c.icon size={11} className="text-primary" />
                                {c.label}
                            </div>
                            <div className="text-lg md:text-xl font-black text-white">
                                {c.value}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{c.sub}</div>
                        </div>
                    ))}
                </section>

                {/* Economics + tiers */}
                <section className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-3 flex items-center gap-1.5">
                            <Zap size={12} className="text-yellow-400" /> How you earn
                        </h3>
                        <ul className="space-y-2 text-xs text-muted-foreground">
                            {[
                                "Share your unique link or code",
                                `Friend connects + trades ≥ $${minVolume} and ${minTrades} trades`,
                                `You earn ${baseShare}–${maxShare}% of their platform fees (lifetime while linked)`,
                                `L2 (your invitee invites) = ${l2Share}% after they qualify`,
                                `Payouts in USDC on Solana when claimable ≥ $${minPayout}`,
                            ].map((line) => (
                                <li key={line} className="flex gap-2 items-start">
                                    <Check
                                        size={12}
                                        className="text-primary shrink-0 mt-0.5"
                                    />
                                    <span>{line}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-3 flex items-center gap-1.5">
                            <Rocket size={12} className="text-purple-400" /> Affiliate tiers
                        </h3>
                        <div className="space-y-1.5">
                            {tiers.map((t) => (
                                <div
                                    key={t.label}
                                    className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5"
                                >
                                    <span className="font-bold text-white">{t.label}</span>
                                    <span className="text-muted-foreground">
                                        {t.minRefs === 0
                                            ? "Start"
                                            : `${t.minRefs}+ qualified refs`}
                                    </span>
                                    <span className="font-black text-primary">
                                        {t.share}%
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
                            Share is of <em>platform fee</em> (not trade notional). Keeps the
                            program sustainable and serious for KOLs.
                        </p>
                    </div>
                </section>

                {/* Why KOLs */}
                <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
                        <Shield size={12} /> Why partners pick SHX
                    </h3>
                    <div className="grid sm:grid-cols-3 gap-3 text-xs">
                        {[
                            {
                                t: "Real product",
                                d: "Jupiter Ultra execution — same best routes traders already trust",
                            },
                            {
                                t: "Cash, not points",
                                d: "USDC payouts after real volume qualification — no vapor seasons",
                            },
                            {
                                t: "Self-custody story",
                                d: "Keys stay in Phantom / Solflare — easy contrast to CEXes",
                            },
                        ].map((x) => (
                            <div key={x.t}>
                                <div className="font-black text-white mb-0.5">{x.t}</div>
                                <div className="text-muted-foreground leading-relaxed">
                                    {x.d}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* How to start */}
                <section>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-2 flex items-center gap-1.5">
                        <Link2 size={12} className="text-cyan-400" /> Start in 3 steps
                    </h3>
                    <div className="grid sm:grid-cols-3 gap-2">
                        {[
                            {
                                n: "1",
                                t: "Open referrals",
                                d: "Connect wallet on shx.exchange/referrals",
                            },
                            {
                                n: "2",
                                t: "Get your link",
                                d: "Copy code → shx.exchange?ref=YOURCODE",
                            },
                            {
                                n: "3",
                                t: "Share & earn",
                                d: "Post tutorial / clip / community pin",
                            },
                        ].map((s) => (
                            <div
                                key={s.n}
                                className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex gap-2.5"
                            >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary text-xs font-black">
                                    {s.n}
                                </span>
                                <div>
                                    <div className="text-xs font-black text-white">{s.t}</div>
                                    <div className="text-[10px] text-muted-foreground leading-snug">
                                        {s.d}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA band */}
                <section className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/20 via-emerald-500/10 to-transparent p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:break-inside-avoid">
                    <div>
                        <div className="text-sm font-black text-white">
                            Ready to partner?
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                            Pilot slots for Solana trading creators · unique codes · public
                            stats
                        </div>
                        <div className="text-[10px] font-mono text-primary mt-1.5">
                            shx.exchange/referrals · shx.exchange/partners
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 print:hidden">
                        <a
                            href="/referrals"
                            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-lime-400 text-black text-xs font-black active:scale-95 transition-transform shadow-[0_0_24px_rgba(34,197,94,0.35)]"
                        >
                            Get my link
                        </a>
                        <button
                            type="button"
                            onClick={copyLink}
                            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white text-xs font-bold active:scale-95"
                        >
                            Copy one-pager URL
                        </button>
                    </div>
                </section>

                {/* Fine print */}
                <p className="text-[9px] text-muted-foreground/80 leading-relaxed border-t border-white/5 pt-3">
                    Not financial advice. Affiliates earn a share of SHX platform fees from
                    qualified referred traders only. Qualification, tiers, and payout rules may
                    update; live terms on shx.exchange/referrals. Disclose paid/affiliate
                    relationships per your jurisdiction. © Shulevitz Holdings Inc.
                </p>
            </div>
        </article>
    );
}
