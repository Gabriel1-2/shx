"use client";

import { useState, useEffect } from "react";
import {
    FileText, Zap, Target, Shield, TrendingUp, BarChart2,
    Layers, Users, Globe, Cpu, Rocket, DollarSign,
    ArrowRight, CheckCircle, ChevronRight, Calendar, Loader2
} from "lucide-react";
import { SHULEVITZ_MINT } from "@/lib/constants";

function Section({ id, title, children, icon: Icon }: { id: string; title: string; children: React.ReactNode; icon: any }) {
    return (
        <section id={id} className="mb-14 scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                    <Icon size={18} className="text-primary" />
                </div>
                <h2 className="text-2xl font-black text-white">{title}</h2>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-4">{children}</div>
        </section>
    );
}

function StatCard({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
            {loading ? (
                <Loader2 size={18} className="animate-spin text-primary mx-auto my-1" />
            ) : (
                <div className="text-xl font-black text-white">{value}</div>
            )}
            {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}

function RoadmapItem({ quarter, title, items, done }: { quarter: string; title: string; items: string[]; done?: boolean }) {
    return (
        <div className={`relative pl-8 pb-8 border-l-2 ${done ? "border-primary/50" : "border-white/10"} last:pb-0`}>
            <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 ${done ? "bg-primary border-primary" : "bg-black border-white/20"}`} />
            <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold ${done ? "text-primary" : "text-muted-foreground"}`}>{quarter}</span>
                {done && <CheckCircle size={12} className="text-primary" />}
            </div>
            <h4 className="text-sm font-bold text-white mb-2">{title}</h4>
            <ul className="space-y-1">
                {items.map((item, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <ChevronRight size={10} className="text-primary shrink-0 mt-0.5" />
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function WhitepaperPage() {
    const [lpData, setLpData] = useState<{ liquidity: string; price: string; volume24h: string; fdv: string; loading: boolean }>({
        liquidity: "—", price: "—", volume24h: "—", fdv: "—", loading: true
    });

    useEffect(() => {
        async function fetchLPData() {
            try {
                const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SHULEVITZ_MINT}`);
                const data = await res.json();
                const pair = data.pairs?.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
                if (pair) {
                    const fmt = (n: number) => {
                        if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
                        if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
                        return `$${n.toFixed(0)}`;
                    };
                    setLpData({
                        liquidity: fmt(pair.liquidity?.usd || 0),
                        price: `$${parseFloat(pair.priceUsd || "0").toFixed(6)}`,
                        volume24h: fmt(pair.volume?.h24 || 0),
                        fdv: fmt(pair.fdv || 0),
                        loading: false,
                    });
                } else {
                    setLpData(prev => ({ ...prev, loading: false }));
                }
            } catch {
                setLpData(prev => ({ ...prev, loading: false }));
            }
        }
        fetchLPData();
        const interval = setInterval(fetchLPData, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="min-h-screen bg-background relative overflow-hidden pb-20">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[180px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-purple-500/8 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10 px-4 md:px-8 pt-8 md:pt-16">
                {/* Hero */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-6">
                        <FileText size={14} />
                        WHITE PAPER v1.0
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4">
                        Shulevitz Exchange
                    </h1>
                    <p className="text-xl md:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400 font-bold mb-6">
                        The Institutional-Grade Non-Custodial DEX
                    </p>
                    <p className="text-muted-foreground text-base max-w-2xl mx-auto">
                        A next-generation decentralized exchange aggregator on Solana, combining institutional-grade infrastructure with AI-native trading capabilities and a loyalty-driven token economy.
                    </p>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-16">
                    <StatCard label="Blockchain" value="Solana" sub="400ms finality" />
                    <StatCard label="Swap Engine" value="Jupiter" sub="Ultra routing" />
                    <StatCard label="LP Pool" value={lpData.liquidity} sub="SHX/USDC on Raydium" loading={lpData.loading} />
                    <StatCard label="Platform Fee" value="0.50-0.65%" sub="Tier-based" />
                </div>

                <div className="bg-black/60 border border-white/10 rounded-2xl backdrop-blur-xl p-6 md:p-10">
                    {/* Table of Contents */}
                    <nav className="mb-14 p-5 bg-white/[0.02] border border-white/5 rounded-xl">
                        <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-bold">Contents</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {[
                                ["executive", "Executive Summary"],
                                ["problem", "Problem Statement"],
                                ["solution", "The SHX Solution"],
                                ["tokenomics", "Tokenomics"],
                                ["utility", "Token Utility"],
                                ["fees", "Fee Tier System"],
                                ["revenue", "Revenue Model"],
                                ["projections", "Volume Projections"],
                                ["roadmap", "Roadmap"],
                                ["team", "Team"],
                            ].map(([id, label]) => (
                                <a key={id} href={`#${id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 py-1">
                                    <ArrowRight size={10} className="text-primary" />
                                    {label}
                                </a>
                            ))}
                        </div>
                    </nav>

                    {/* Executive Summary */}
                    <Section id="executive" title="Executive Summary" icon={FileText}>
                        <p>Shulevitz Exchange (SHX) is a non-custodial decentralized exchange aggregator built on the Solana blockchain. Unlike traditional CEXs that custody user funds, SHX operates as a pure software interface that routes trades through Jupiter&apos;s aggregation engine — ensuring users always maintain full ownership of their assets.</p>
                        <p>The Shulevitz token serves as the platform&apos;s utility token, providing holders with tiered fee discounts, leaderboard rewards, and future governance rights. By holding more SHX, traders unlock progressively lower fees — creating a natural demand flywheel that aligns incentives between the platform and its users.</p>
                        <p><strong className="text-white">Key differentiators:</strong></p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Zero counterparty risk — fully non-custodial architecture</li>
                            <li>AI-native Agent API for autonomous trading systems</li>
                            <li>Integrated fiat on-ramp (MoonPay, Stripe) for seamless onboarding</li>
                            <li>Progressive fee tiers that reward loyalty</li>
                            <li>Institutional-grade pro trading terminal</li>
                        </ul>
                    </Section>

                    {/* Problem */}
                    <Section id="problem" title="Problem Statement" icon={Target}>
                        <p>The current DEX landscape suffers from several critical issues:</p>
                        <div className="grid gap-4 md:grid-cols-2 mt-4">
                            {[
                                { title: "No Loyalty Incentives", desc: "Existing DEXs treat all users identically regardless of volume or loyalty. Active traders get no benefit over casual users." },
                                { title: "Onboarding Friction", desc: "New users must navigate complex wallet setups and bridge assets from centralized exchanges before trading." },
                                { title: "No AI Infrastructure", desc: "Autonomous trading agents have no native DeFi infrastructure — they must cobble together fragmented APIs." },
                                { title: "Fragmented Experience", desc: "Users must switch between multiple platforms for charting, swapping, analytics, and portfolio tracking." },
                            ].map((p, i) => (
                                <div key={i} className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                                    <h4 className="text-sm font-bold text-white mb-1">{p.title}</h4>
                                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* Solution */}
                    <Section id="solution" title="The SHX Solution" icon={Zap}>
                        <p>SHX addresses each problem with a comprehensive, integrated platform:</p>
                        <div className="grid gap-4 md:grid-cols-2 mt-4">
                            {[
                                { icon: Layers, title: "Fee Tiers", desc: "Hold Shulevitz tokens to unlock lower trading fees — from 0.65% down to 0.50% for Diamond holders." },
                                { icon: Globe, title: "Fiat On-Ramp", desc: "Buy crypto directly with Apple Pay, Google Pay, and credit cards via embedded MoonPay and Stripe widgets." },
                                { icon: Cpu, title: "Agent API", desc: "RESTful API endpoints for autonomous trading agents to swap, quote, and manage positions programmatically." },
                                { icon: BarChart2, title: "Pro Terminal", desc: "Institutional-grade trading interface with live charts, order book depth, real-time market data, and Jupiter Ultra routing." },
                            ].map((s, i) => (
                                <div key={i} className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <s.icon size={14} className="text-primary" />
                                        <h4 className="text-sm font-bold text-white">{s.title}</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* Tokenomics */}
                    <Section id="tokenomics" title="Tokenomics" icon={DollarSign}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <StatCard label="Token Name" value="Shulevitz" sub="Ticker: SHX" />
                            <StatCard label="Blockchain" value="Solana" sub="SPL Token Standard" />
                            <StatCard label="Pool Liquidity" value={lpData.liquidity} sub="SHX/USDC" loading={lpData.loading} />
                            <StatCard label="Token Price" value={lpData.price} sub="Live" loading={lpData.loading} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <StatCard label="24h Volume" value={lpData.volume24h} sub="DexScreener" loading={lpData.loading} />
                            <StatCard label="Fully Diluted Value" value={lpData.fdv} sub="Market cap" loading={lpData.loading} />
                        </div>
                        <p><strong className="text-white">Mint Address:</strong></p>
                        <code className="block text-xs font-mono text-primary bg-primary/5 border border-primary/10 rounded-lg p-3 break-all">
                            336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q
                        </code>
                        <p className="mt-4"><strong className="text-white">Liquidity Pool ID (Raydium):</strong></p>
                        <code className="block text-xs font-mono text-cyan-400 bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-3 break-all">
                            65aXZcQAdqqHnbrABPnnSH8eTGXszLBk4UXRZqpceDAE
                        </code>
                        <p className="mt-4"><strong className="text-white">Current Liquidity:</strong> {lpData.loading ? "Loading..." : `${lpData.liquidity}`} in the SHX/USDC pool on Raydium. This provides a solid foundation for price discovery and trading. Additional LP is being provisioned to deepen liquidity ahead of major exchange partnerships.</p>
                    </Section>

                    {/* Utility */}
                    <Section id="utility" title="Token Utility" icon={Shield}>
                        <div className="space-y-3">
                            {[
                                { title: "Fee Tier Discounts", desc: "Hold SHX to unlock progressively lower trading fees — from 0.65% at Base to 0.50% at Diamond tier.", active: true },
                                { title: "Zero-Fee SHX Purchases", desc: "Buying SHX on the platform incurs a 0% platform fee, encouraging token acquisition.", active: true },
                                { title: "Leaderboard & Rewards", desc: "Top traders by weekly fees paid share a $250 reward pool (top 10, min $10 fees).", active: true },
                                { title: "Referral Revenue Share", desc: "Lifetime 50–65% of platform fees from L1 invites, 10% L2, plus 15% cashback and 1.5× XP for invited traders.", active: true },
                                { title: "Governance (Upcoming)", desc: "Shulevitz holders will vote on fee structures, reward pool sizes, and platform features.", active: false },
                                { title: "Revenue Sharing (Upcoming)", desc: "Diamond tier holders will receive a share of platform trading fees.", active: false },
                                { title: "Staking Rewards (Upcoming)", desc: "Lock Shulevitz tokens to earn yield from platform revenue.", active: false },
                            ].map((u, i) => (
                                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${u.active ? "bg-primary/5 border border-primary/10" : "bg-white/[0.02] border border-white/5"}`}>
                                    <CheckCircle size={14} className={u.active ? "text-primary shrink-0 mt-0.5" : "text-muted-foreground shrink-0 mt-0.5"} />
                                    <div>
                                        <span className={`text-xs font-bold ${u.active ? "text-white" : "text-muted-foreground"}`}>{u.title}</span>
                                        {!u.active && <span className="text-[9px] text-yellow-400 ml-2 bg-yellow-400/10 px-1.5 py-0.5 rounded">Coming Soon</span>}
                                        <p className="text-xs text-muted-foreground mt-0.5">{u.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* Fee Tiers */}
                    <Section id="fees" title="Fee Tier System" icon={Layers}>
                        <p>The SHX fee tier system rewards loyal token holders with progressively lower trading fees:</p>
                        <div className="overflow-x-auto mt-4">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-3 text-muted-foreground font-bold uppercase tracking-wider">Tier</th>
                                        <th className="text-left py-3 text-muted-foreground font-bold uppercase tracking-wider">Min SHX</th>
                                        <th className="text-left py-3 text-muted-foreground font-bold uppercase tracking-wider">Fee Rate</th>
                                        <th className="text-left py-3 text-muted-foreground font-bold uppercase tracking-wider">Savings</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono">
                                    {[
                                        { tier: "Base", min: "0", fee: "0.65%", save: "—", color: "text-white" },
                                        { tier: "Silver 🥈", min: "10,000", fee: "0.60%", save: "7.7%", color: "text-gray-300" },
                                        { tier: "Gold 🥇", min: "50,000", fee: "0.55%", save: "15.4%", color: "text-yellow-400" },
                                        { tier: "Platinum 💎", min: "100,000", fee: "0.52%", save: "20.0%", color: "text-cyan-400" },
                                        { tier: "Diamond 👑", min: "500,000", fee: "0.50%", save: "23.1%", color: "text-purple-400" },
                                    ].map((t, i) => (
                                        <tr key={i} className="border-b border-white/5">
                                            <td className={`py-2.5 font-bold ${t.color}`}>{t.tier}</td>
                                            <td className="py-2.5 text-white">{t.min}</td>
                                            <td className="py-2.5 text-primary font-bold">{t.fee}</td>
                                            <td className="py-2.5 text-green-400">{t.save}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    {/* Revenue Model */}
                    <Section id="revenue" title="Revenue Model" icon={DollarSign}>
                        <div className="grid gap-4 md:grid-cols-2">
                            {[
                                { title: "Trading Fees", desc: "0.50–0.65% per swap routed through Jupiter Ultra. Primary revenue source.", pct: "70%" },
                                { title: "Fiat On-Ramp Commission", desc: "Revenue share with MoonPay and Stripe on fiat-to-crypto purchases.", pct: "15%" },
                                { title: "Agent API Fees", desc: "Usage-based pricing for institutional and bot trading via the REST API.", pct: "10%" },
                                { title: "Premium Analytics", desc: "Subscription tier for advanced charting, alerts, and portfolio analytics.", pct: "5%" },
                            ].map((r, i) => (
                                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-bold text-white">{r.title}</h4>
                                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{r.pct}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* Volume Projections */}
                    <Section id="projections" title="Expected Volume Projections" icon={TrendingUp}>
                        <p>Conservative-to-moderate projections based on comparable Solana DEX aggregator growth trajectories (Birdeye, Photon, BullX):</p>

                        <h3 className="text-sm font-bold text-white mt-6 mb-3 flex items-center gap-2">
                            <BarChart2 size={14} className="text-primary" /> Swap Volume (Jupiter-Routed)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs font-mono">
                                <thead><tr className="border-b border-white/10">
                                    <th className="text-left py-2 text-muted-foreground font-bold">Period</th>
                                    <th className="text-left py-2 text-muted-foreground font-bold">Daily Volume</th>
                                    <th className="text-left py-2 text-muted-foreground font-bold">Monthly Revenue</th>
                                </tr></thead>
                                <tbody className="text-white">
                                    <tr className="border-b border-white/5"><td className="py-2">Month 1–3</td><td>$50K – $200K</td><td className="text-primary">$9.75K – $39K</td></tr>
                                    <tr className="border-b border-white/5"><td className="py-2">Month 4–6</td><td>$200K – $1M</td><td className="text-primary">$39K – $195K</td></tr>
                                    <tr className="border-b border-white/5"><td className="py-2">Month 7–12</td><td>$1M – $5M</td><td className="text-primary">$195K – $975K</td></tr>
                                    <tr><td className="py-2">Year 2</td><td>$5M – $20M</td><td className="text-primary">$975K – $3.9M</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Revenue calculated at blended 0.65% fee rate × 30 days.</p>

                        <h3 className="text-sm font-bold text-white mt-6 mb-3 flex items-center gap-2">
                            <Globe size={14} className="text-purple-400" /> Fiat On-Ramp (MoonPay / Stripe)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs font-mono">
                                <thead><tr className="border-b border-white/10">
                                    <th className="text-left py-2 text-muted-foreground font-bold">Period</th>
                                    <th className="text-left py-2 text-muted-foreground font-bold">Monthly Volume</th>
                                    <th className="text-left py-2 text-muted-foreground font-bold">Est. Commission</th>
                                </tr></thead>
                                <tbody className="text-white">
                                    <tr className="border-b border-white/5"><td className="py-2">Month 1–3</td><td>$10K – $50K</td><td className="text-purple-400">$100 – $500</td></tr>
                                    <tr className="border-b border-white/5"><td className="py-2">Month 4–6</td><td>$50K – $250K</td><td className="text-purple-400">$500 – $2.5K</td></tr>
                                    <tr className="border-b border-white/5"><td className="py-2">Month 7–12</td><td>$250K – $1M</td><td className="text-purple-400">$2.5K – $10K</td></tr>
                                    <tr><td className="py-2">Year 2</td><td>$1M – $5M</td><td className="text-purple-400">$10K – $50K</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Commission at ~1% revenue share with provider.</p>

                        <h3 className="text-sm font-bold text-white mt-6 mb-3 flex items-center gap-2">
                            <Cpu size={14} className="text-cyan-400" /> Commerce / Agent API
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs font-mono">
                                <thead><tr className="border-b border-white/10">
                                    <th className="text-left py-2 text-muted-foreground font-bold">Period</th>
                                    <th className="text-left py-2 text-muted-foreground font-bold">Monthly Volume</th>
                                    <th className="text-left py-2 text-muted-foreground font-bold">Est. Revenue</th>
                                </tr></thead>
                                <tbody className="text-white">
                                    <tr className="border-b border-white/5"><td className="py-2">Month 1–3</td><td>$5K – $25K</td><td className="text-cyan-400">$25 – $163</td></tr>
                                    <tr className="border-b border-white/5"><td className="py-2">Month 4–6</td><td>$25K – $100K</td><td className="text-cyan-400">$163 – $650</td></tr>
                                    <tr className="border-b border-white/5"><td className="py-2">Month 7–12</td><td>$100K – $500K</td><td className="text-cyan-400">$650 – $3.25K</td></tr>
                                    <tr><td className="py-2">Year 2</td><td>$500K – $2M</td><td className="text-cyan-400">$3.25K – $13K</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Revenue at 0.65% platform fee on API-routed swaps.</p>

                        <div className="mt-6 bg-primary/5 border border-primary/15 rounded-xl p-4">
                            <h4 className="text-sm font-bold text-white mb-2">Year 2 Combined Revenue Potential</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <StatCard label="Swaps" value="$975K–$3.9M" sub="Annual" />
                                <StatCard label="Ramps" value="$120K–$600K" sub="Annual" />
                                <StatCard label="API" value="$39K–$156K" sub="Annual" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 text-center">
                                Total Year 2 projected revenue: <strong className="text-primary text-sm">$1.1M – $4.7M</strong>
                            </p>
                        </div>
                    </Section>

                    {/* Roadmap */}
                    <Section id="roadmap" title="Roadmap" icon={Calendar}>
                        <div className="mt-4">
                            <RoadmapItem
                                quarter="Q1 2026"
                                title="Platform Foundation"
                                items={[
                                    "Core DEX aggregator launch via Jupiter",
                                    "Shulevitz token creation and Raydium LP",
                                    "Fee tier system implementation",
                                    "Leaderboard and XP rewards",
                                    "Firebase real-time analytics"
                                ]}
                                done
                            />
                            <RoadmapItem
                                quarter="Q2 2026"
                                title="Institutional Infrastructure"
                                items={[
                                    "Pro trading terminal with live charts",
                                    "Fiat on-ramp (MoonPay + Stripe integration)",
                                    "Progressive Web App (PWA)",
                                    "Agent REST API for bot trading",
                                    "Referral program launch"
                                ]}
                                done
                            />
                            <RoadmapItem
                                quarter="Q3 2026"
                                title="Advanced Trading"
                                items={[
                                    "Limit orders via Jupiter DCA",
                                    "Advanced portfolio analytics",
                                    "Mobile-optimized trading experience",
                                    "Multi-token charting with TradingView",
                                    "Institutional partnership program"
                                ]}
                            />
                            <RoadmapItem
                                quarter="Q4 2026"
                                title="Governance & Revenue Sharing"
                                items={[
                                    "On-chain governance voting for Shulevitz holders",
                                    "Revenue sharing for Diamond tier",
                                    "SHX staking program",
                                    "Advanced API v2 with WebSocket feeds",
                                    "CEX listing campaigns"
                                ]}
                            />
                            <RoadmapItem
                                quarter="2027"
                                title="Ecosystem Expansion"
                                items={[
                                    "Cross-chain expansion (Base, Arbitrum)",
                                    "White-label DEX infrastructure",
                                    "Institutional custody API partnerships",
                                    "Advanced DeFi strategies (auto-compounding, vaults)",
                                    "Mobile native apps (iOS / Android)"
                                ]}
                            />
                        </div>
                    </Section>

                    {/* Team */}
                    <Section id="team" title="Team" icon={Users}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                                <h3 className="text-lg font-bold text-white mb-1">Yeshaya Shulevitz</h3>
                                <p className="text-xs text-primary mb-3">Founder & CEO</p>
                                <p>Visionary behind the SHX platform. Presented at a crypto Y Combinator-style accelerator with strong investor interest from institutional players. Focused on the intersection of DeFi, AI, and institutional trading.</p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                                <h3 className="text-lg font-bold text-white mb-1">Gabriel Shagas</h3>
                                <p className="text-xs text-primary mb-3">CTO / Tech Overlord</p>
                                <p>Lead architect and core developer of the SHX platform. Specializing in high-performance Solana infrastructure, robust smart contract integrations, and AI-native trading capabilities.</p>
                            </div>
                        </div>
                    </Section>

                    {/* Disclaimer */}
                    <div className="mt-14 pt-8 border-t border-white/10">
                        <h3 className="text-sm font-bold text-white mb-3">Legal Disclaimer</h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            This white paper is for informational purposes only and does not constitute financial, investment, legal, or tax advice. The Shulevitz token is a utility token and is not intended to be a security, commodity, or any other form of regulated financial instrument. Cryptocurrency trading involves substantial risk of loss. Past performance is not indicative of future results. Projections and forward-looking statements are estimates based on current market conditions and comparable protocols — actual results may differ materially. SHX Exchange does not guarantee any returns on investment. Users should conduct their own research and consult with qualified financial advisors before making any investment decisions. The regulatory landscape for digital assets is evolving — users are responsible for compliance with local laws.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
