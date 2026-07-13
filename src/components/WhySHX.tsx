"use client";

import Link from "next/link";
import {
    Shield, Bot, Gift, Layers, Zap, Crown, ArrowRight, Check,
} from "lucide-react";

const PILLARS = [
    {
        icon: Shield,
        title: "Non-custodial. Always.",
        desc: "Keys stay in Phantom / Solflare. We never hold funds — Jupiter Ultra settles on-chain.",
        color: "text-green-400",
        border: "border-green-500/20",
        bg: "from-green-500/10",
    },
    {
        icon: Layers,
        title: "Hold SHX → lower fees",
        desc: "Base 0.65% down to 0.50% Diamond. Buy SHX at 0% platform fee. Loyalty that pays.",
        color: "text-purple-400",
        border: "border-purple-500/20",
        bg: "from-purple-500/10",
    },
    {
        icon: Gift,
        title: "Referrals that pay USDC",
        desc: "25–35% of fees after invitees trade $100+. Auto USDC at $5 claimable. Not vapor points.",
        color: "text-emerald-400",
        border: "border-emerald-500/20",
        bg: "from-emerald-500/10",
    },
    {
        icon: Bot,
        title: "Agent-native API",
        desc: "Connect → quote → sign → swap. Built for bots & AI. No SDK hell. CORS open.",
        color: "text-cyan-400",
        border: "border-cyan-500/20",
        bg: "from-cyan-500/10",
    },
    {
        icon: Zap,
        title: "Pro desk: Limit + DCA",
        desc: "Trigger V2 limits and Recurring DCA beside live charts. One terminal, not five tabs.",
        color: "text-yellow-400",
        border: "border-yellow-500/20",
        bg: "from-yellow-500/10",
    },
    {
        icon: Crown,
        title: "Live proof, not marketing",
        desc: "Hot tape + SHX trade tape + unique wallets, fees, weekly race, referral payouts — from our ledger.",
        color: "text-primary",
        border: "border-primary/20",
        bg: "from-primary/10",
    },
];

const VS = [
    { them: "Jupiter UI", us: "Same Ultra routes + loyalty tiers + USDC referrals + agent API + race" },
    { them: "Photon / Axiom", us: "Self-custody desk + real USDC fee share + public SHX trade tape" },
    { them: "TG bots", us: "Full web desk, charts, DCA, compliance, live ledger proof" },
    { them: "Points-only DEXs", us: "Auto USDC after volume qualification + weekly cash race" },
];

export function WhySHX() {
    return (
        <section className="w-full space-y-6">
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] font-black uppercase tracking-widest mb-3">
                    Why traders switch
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    Built to{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-lime-400 to-emerald-400">
                        outclass
                    </span>{" "}
                    the stack you already use
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
                    We don&apos;t fake deeper liquidity than Jupiter. We wrap best-in-class execution with
                    incentives, pro tools, and agent infrastructure nobody else bundles cleanly.
                </p>
            </div>

            {/* Mobile: horizontal snap cards · Desktop: grid */}
            <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible scrollbar-hide snap-x snap-mandatory pb-1 -mx-1 px-1 md:mx-0 md:px-0">
                {PILLARS.map((p) => (
                    <div
                        key={p.title}
                        className={`shrink-0 w-[78vw] max-w-[280px] md:w-auto md:max-w-none snap-start rounded-2xl border ${p.border} bg-gradient-to-br ${p.bg} to-transparent p-4 backdrop-blur-sm active:scale-[0.98] md:hover:scale-[1.02] transition-transform`}
                    >
                        <p.icon size={18} className={`${p.color} mb-2`} />
                        <h3 className="text-sm font-black text-white mb-1">{p.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 text-xs font-bold text-white uppercase tracking-wider">
                    Us vs the field
                </div>
                <div className="divide-y divide-white/5">
                    {VS.map((row) => (
                        <div
                            key={row.them}
                            className="grid md:grid-cols-2 gap-2 px-4 py-3 text-xs"
                        >
                            <div className="text-muted-foreground">
                                <span className="text-[10px] uppercase opacity-60">Them · </span>
                                {row.them}
                            </div>
                            <div className="text-white flex items-start gap-1.5">
                                <Check size={12} className="text-primary shrink-0 mt-0.5" />
                                {row.us}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
                <Link
                    href="/pro"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-black text-sm hover:opacity-90"
                >
                    Open Pro Desk <ArrowRight size={14} />
                </Link>
                <Link
                    href="/referrals"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold text-sm hover:bg-emerald-500/15"
                >
                    Earn USDC referrals
                </Link>
                <a
                    href="/api/agent/health"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-bold text-sm hover:bg-cyan-500/15"
                >
                    Agent API
                </a>
            </div>
        </section>
    );
}
