"use client";

import Link from "next/link";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    Coins, Droplets, ExternalLink, TrendingUp, ShieldCheck,
    Zap, Lock, Clock, ChevronDown, ChevronUp, Wallet,
    BarChart2, Gift, ArrowUpRight, Flame, Info, Loader2, X, Pickaxe
} from "lucide-react";

const RAYDIUM_POOL_ID = "65aXZcQAdqqHnbrABPnnSH8eTGXszLBk4UXRZqpceDAE";
import { SHULEVITZ_MINT } from "@/lib/constants";

// ─── Live pool data fetcher ────────────────────────────────────
interface PoolData {
    tvl: number;
    volume24h: number;
    priceUsd: number;
    priceChange24h: number;
    fdv: number;
}

async function fetchPoolData(): Promise<PoolData> {
    try {
        const res = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${SHULEVITZ_MINT}`
        );
        const data = await res.json();
        const pairs = data.pairs || [];
        // Pick highest-liquidity pair
        const best = pairs.sort(
            (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];
        if (!best) throw new Error("No pairs");
        return {
            tvl: best.liquidity?.usd || 0,
            volume24h: best.volume?.h24 || 0,
            priceUsd: parseFloat(best.priceUsd) || 0,
            priceChange24h: best.priceChange?.h24 || 0,
            fdv: best.fdv || 0,
        };
    } catch {
        return { tvl: 44000, volume24h: 0, priceUsd: 0, priceChange24h: 0, fdv: 0 };
    }
}

function computeApy(volume24h: number, tvl: number): number {
    if (tvl <= 0) return 0;
    const dailyFees = volume24h * 0.0025; // 0.25% Raydium fee tier
    return ((dailyFees * 365) / tvl) * 100;
}

// ─── Yield Calculator ──────────────────────────────────────────
function YieldCalculator({
    feeApy,
    farmApy,
    shxPrice,
}: {
    feeApy: number;
    farmApy: number;
    shxPrice: number;
}) {
    const [amount, setAmount] = useState(1000);
    const totalApy = feeApy + farmApy;
    const daily = (amount * (totalApy / 100)) / 365;
    const weekly = daily * 7;
    const monthly = daily * 30;
    const yearly = amount * (totalApy / 100);

    return (
        <div className="bg-black/60 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <BarChart2 size={18} className="text-green-400" /> Yield Calculator
            </h3>
            <p className="text-[10px] text-muted-foreground mb-4">
                Uses live trading-fee APY ({feeApy.toFixed(1)}%)
                {farmApy > 0 ? ` + stated farm APY (${farmApy.toFixed(1)}%)` : ""}. Estimates only.
            </p>
            <div className="mb-4">
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                    Your deposit (USD)
                </label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min={100}
                        max={50000}
                        step={100}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="flex-1 accent-green-500 h-2"
                    />
                    <span className="text-white font-mono font-bold w-24 text-right">
                        ${amount.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                    <span>$100</span><span>$50,000</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: "Daily", value: daily },
                    { label: "Weekly", value: weekly },
                    { label: "Monthly", value: monthly },
                    { label: "Yearly", value: yearly },
                ].map((p) => (
                    <div key={p.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">{p.label}</p>
                        <p className="text-lg font-black text-green-400">
                            ${p.value.toFixed(2)}
                        </p>
                        {shxPrice > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                                ≈ {(p.value / shxPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })} SHULEVITZ
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── FAQ ────────────────────────────────────────────────────────
const FAQ_ITEMS = [
    {
        q: "What is liquidity mining?",
        a: "When you provide liquidity, you deposit equal values of two tokens (SHULEVITZ + SOL) into a pool. Every time someone swaps between those tokens, you earn a percentage of the trading fee proportional to your share of the pool.",
    },
    {
        q: "What are the risks?",
        a: "The primary risk is Impermanent Loss (IL). If the price of SHULEVITZ moves significantly relative to SOL, your position may be worth less than simply holding. However, trading fees can offset this loss over time.",
    },
    {
        q: "How is the APY calculated?",
        a: "Trading-fee APY is live: 24h volume × pool fee rate (typically ~0.25% on Raydium CLMM), annualized as (dailyFees × 365 / TVL) × 100. Farm/reward APY (if any) is separate and labeled — never mixed silently into one number. Figures fluctuate with volume and are estimates only.",
    },
    {
        q: "Can I withdraw anytime?",
        a: "Yes. Your liquidity is fully non-custodial and can be withdrawn at any time through Raydium. There are no lock-up periods or withdrawal penalties.",
    },
    {
        q: "Do I need both SHULEVITZ and SOL?",
        a: "Yes, you provide a 50/50 split by value. If you only have SOL, you can swap half to SHULEVITZ on the main SHX Exchange page first, then provide liquidity with both.",
    },
];

function FaqSection() {
    const [open, setOpen] = useState<number | null>(null);
    return (
        <div className="space-y-2">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Info size={18} className="text-blue-400" /> Frequently Asked Questions
            </h3>
            {FAQ_ITEMS.map((item, i) => (
                <div
                    key={i}
                    className="bg-white/5 border border-white/5 rounded-xl overflow-hidden transition-all"
                >
                    <button
                        onClick={() => setOpen(open === i ? null : i)}
                        className="w-full flex items-center justify-between p-4 text-left"
                    >
                        <span className="text-sm font-bold text-white pr-4">{item.q}</span>
                        {open === i ? (
                            <ChevronUp size={16} className="text-muted-foreground shrink-0" />
                        ) : (
                            <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                        )}
                    </button>
                    {open === i && (
                        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed animate-fadeIn">
                            {item.a}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function EarnPage() {
    const { connected, publicKey } = useWallet();
    const [pool, setPool] = useState<PoolData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPoolData().then((d) => {
            setPool(d);
            setLoading(false);
        });
        const interval = setInterval(() => {
            fetchPoolData().then(setPool);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Live trading-fee APY from volume/TVL (honest, fluctuates)
    const feeApy = pool ? computeApy(pool.volume24h, pool.tvl) : 0;
    // Farm rewards: only show if we have a verified figure; otherwise 0 + disclaimer
    // Do NOT hardcode fake farm APY — users should verify on Raydium Farms page.
    const farmApy = 0;
    const totalApy = feeApy + farmApy;

    const openRaydiumPopup = () => {
        const width = 600;
        const height = 800;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        window.open(
            `https://raydium.io/liquidity/increase/?mode=add&pool_id=${RAYDIUM_POOL_ID}`,
            "Raydium",
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
    };

    return (
        <main className="min-h-screen bg-background relative overflow-x-hidden pb-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] md:w-[900px] h-[220px] md:h-[500px] bg-green-500/15 blur-[100px] md:blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[50%] h-[40%] bg-primary/8 blur-[100px] rounded-full pointer-events-none hidden sm:block" />

            <div className="max-w-6xl mx-auto relative z-10 px-3 md:px-8 pt-3 md:pt-12">
                <div className="text-center mb-6 md:mb-10">
                    <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] md:text-xs font-bold mb-3 md:mb-6">
                        <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex h-full w-full rounded-full bg-green-500" />
                        </span>
                        LIQUIDITY LIVE
                    </div>
                    <h1 className="text-xl md:text-5xl lg:text-6xl font-black text-white tracking-tight mb-2 md:mb-4 leading-tight">
                        Provide Liquidity.{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-500 to-green-600">
                            Earn Yield.
                        </span>
                    </h1>
                    <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                        Deposit SHULEVITZ + SOL into decentralized liquidity pools.
                        Earn trading fees on every swap — automatically.
                    </p>
                </div>

                {/* ── Live Stats Row ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
                    {[
                        {
                            label: "Total Value Locked",
                            value: loading ? "..." : `$${(pool?.tvl || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                            icon: Lock,
                            color: "text-primary",
                            glow: "from-primary/10 to-emerald-500/10",
                        },
                        {
                            label: "Fee APY (live)",
                            value: loading ? "..." : `${feeApy.toFixed(1)}%`,
                            icon: Flame,
                            color: "text-green-400",
                            glow: "from-green-500/10 to-lime-500/10",
                            sub: "From 24h volume · trading fees only",
                        },
                        {
                            label: "24h Volume",
                            value: loading ? "..." : `$${(pool?.volume24h || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                            icon: TrendingUp,
                            color: "text-cyan-400",
                            glow: "from-cyan-500/10 to-blue-500/10",
                        },
                        {
                            label: "SHULEVITZ Price",
                            value: loading
                                ? "..."
                                : pool?.priceUsd
                                    ? `$${pool.priceUsd < 0.01 ? pool.priceUsd.toFixed(6) : pool.priceUsd.toFixed(4)}`
                                    : "—",
                            icon: Coins,
                            color: (pool?.priceChange24h || 0) >= 0 ? "text-green-400" : "text-red-400",
                            glow: "from-purple-500/10 to-pink-500/10",
                            sub: pool?.priceChange24h ? `${pool.priceChange24h >= 0 ? "+" : ""}${pool.priceChange24h.toFixed(1)}%` : undefined,
                        },
                    ].map((stat, i) => (
                        <div
                            key={i}
                            className="group relative bg-black/50 border border-white/10 rounded-2xl p-4 md:p-5 backdrop-blur-xl hover:border-white/20 transition-all duration-300"
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${stat.glow} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-2">
                                    <stat.icon size={14} className={stat.color} />
                                    <span className="text-[10px] md:text-xs text-muted-foreground uppercase font-bold tracking-wider">
                                        {stat.label}
                                    </span>
                                </div>
                                <div className={`text-xl md:text-2xl font-black ${stat.color}`}>
                                    {stat.value}
                                </div>
                                {stat.sub && (
                                    <div className={`text-[10px] font-medium mt-1 ${
                                        i === 3
                                            ? (pool?.priceChange24h || 0) >= 0 ? "text-green-400" : "text-red-400"
                                            : "text-muted-foreground"
                                    }`}>
                                        {stat.sub}{i === 3 ? " (24h)" : ""}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Main Grid ── */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left — Pool Card + CTA */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* SHULEVITZ-USDC Raydium Pool */}
                        <div className="bg-black/60 border border-primary/30 rounded-2xl p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(34,197,94,0.08)]">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex -space-x-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center border-2 border-black z-10 shadow-lg shadow-green-500/20">
                                            <span className="text-xs font-black text-black">SHULEVITZ</span>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center border-2 border-black overflow-hidden">
                                            <span className="text-[8px] font-black text-white">USDC</span>
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                                            SHULEVITZ / USDC
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                                                Raydium
                                            </span>
                                        </h2>
                                        <p className="text-sm text-muted-foreground">Pool ID: {RAYDIUM_POOL_ID.slice(0, 8)}... • Concentrated Liquidity</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 md:gap-6">
                                    <div className="text-right">
                                        <p className="text-[10px] text-muted-foreground uppercase mb-0.5">TVL</p>
                                        <p className="font-mono text-white font-bold text-lg">
                                            ${loading ? "..." : (pool?.tvl || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Fee APY</p>
                                        <p className="font-mono text-green-400 font-bold text-lg">
                                            {loading ? "..." : `${feeApy.toFixed(1)}%`}
                                        </p>
                                        <p className="text-[9px] text-muted-foreground">live · volume-based</p>
                                    </div>
                                </div>
                            </div>

                            {/* Honest APY breakdown */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="rounded-xl bg-white/5 border border-white/5 p-3">
                                    <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Trading fee APY</p>
                                    <p className="text-lg font-black text-green-400 font-mono">
                                        {loading ? "…" : `${feeApy.toFixed(2)}%`}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">Live from DexScreener volume</p>
                                </div>
                                <div className="rounded-xl bg-white/5 border border-white/5 p-3">
                                    <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Farm / rewards APY</p>
                                    <p className="text-lg font-black text-white font-mono">
                                        {farmApy > 0 ? `${farmApy.toFixed(1)}%` : "Check farm"}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">Verify on Raydium Farms (not estimated here)</p>
                                </div>
                            </div>

                            {/* Info Banner */}
                            <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4 mb-5 flex items-start gap-3">
                                <Pickaxe className="text-green-400 shrink-0 mt-0.5" size={18} />
                                <div className="text-sm text-muted-foreground">
                                    <strong className="text-white">LP is non-custodial on Raydium.</strong>{" "}
                                    Fee APY above is a live estimate from 24h volume. Any farm rewards (SHX or otherwise)
                                    are separate — always confirm the current farm rate on Raydium before staking LP.
                                    Combined estimate:{" "}
                                    <span className="text-white font-mono font-bold">
                                        {loading ? "…" : `~${totalApy.toFixed(1)}% fee APY`}
                                    </span>
                                    {farmApy <= 0 ? " + farm (external)" : ` + ${farmApy.toFixed(1)}% farm`}.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <button
                                    onClick={openRaydiumPopup}
                                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 text-black py-3.5 rounded-xl font-black text-sm transition-all shadow-[0_0_25px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] hover:scale-[1.02]"
                                >
                                    <Droplets size={16} /> 1. Add Liquidity
                                </button>
                                <a
                                    href="https://raydium.io/farms/?tab=Ecosystem"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black py-3.5 rounded-xl font-black text-sm transition-all shadow-[0_0_25px_rgba(34,197,94,0.3)] hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] hover:scale-[1.02]"
                                >
                                    <Pickaxe size={16} /> 2. Stake to Farm
                                </a>
                            </div>
                        </div>

                        {/* Yield Calculator */}
                        <YieldCalculator
                            feeApy={feeApy}
                            farmApy={farmApy}
                            shxPrice={pool?.priceUsd || 0}
                        />

                        {/* Orca Pool — Coming Soon */}
                        <div className="bg-black/30 border border-white/5 rounded-2xl p-6 opacity-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex -space-x-3 grayscale">
                                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border-2 border-black z-10">
                                            <span className="text-[10px] font-black text-gray-500">SHULEVITZ</span>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-gray-900 border-2 border-black" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-gray-500">SHULEVITZ-USDC • Orca Whirlpool</h3>
                                        <p className="text-xs text-gray-600">Coming Soon</p>
                                    </div>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-gray-500 font-bold border border-white/5">
                                    Upcoming
                                </span>
                            </div>
                        </div>

                        {/* FAQ */}
                        <FaqSection />
                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-6">
                        {/* How It Works */}
                        <div className="bg-black/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                                <Gift size={18} className="text-primary" /> How It Works
                            </h3>
                            <div className="space-y-5">
                                {[
                                    { step: "1", label: "Get SHULEVITZ + SOL", desc: "Make sure you hold both tokens. Swap on the main exchange if needed.", color: "bg-primary/20 text-primary" },
                                    { step: "2", label: "Deposit into Pool", desc: "Click 'Add Liquidity' above to open Raydium and deposit.", color: "bg-cyan-500/20 text-cyan-400" },
                                    { step: "3", label: "Receive LP Tokens", desc: "Your LP tokens represent your share of the pool.", color: "bg-purple-500/20 text-purple-400" },
                                    { step: "4", label: "Stake in Farm", desc: "Click 'Stake to Farm' and deposit your LP tokens in Raydium's Ecosystem farm to earn the bonus SHX APY!", color: "bg-green-500/20 text-green-400" },
                                ].map((item) => (
                                    <div key={item.step} className="flex items-start gap-3">
                                        <div className={`w-7 h-7 rounded-full ${item.color} flex items-center justify-center text-xs font-black shrink-0`}>
                                            {item.step}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{item.label}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Risk Warning */}
                        <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <ShieldCheck size={16} className="text-yellow-400" />
                                <span className="text-xs font-bold text-yellow-400 uppercase">Risk Disclosure</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Providing liquidity involves risk including impermanent loss. Fee APY is a live estimate from 24h volume; farm rates must be verified on Raydium and are not guaranteed. Your LP is held in Raydium contracts — not by SHX Exchange.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div className="bg-black/50 border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
                            <h4 className="text-sm font-bold text-white mb-3">Resources</h4>
                            <div className="space-y-2">
                                {[
                                    { label: "SHULEVITZ on DexScreener", href: `https://dexscreener.com/solana/${SHULEVITZ_MINT}` },
                                    { label: "Raydium Docs", href: "https://docs.raydium.io/" },
                                    { label: "What is IL?", href: "https://academy.binance.com/en/articles/impermanent-loss-explained" },
                                ].map((link) => (
                                    <a
                                        key={link.label}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                                    >
                                        <span className="text-xs text-muted-foreground group-hover:text-white transition-colors">{link.label}</span>
                                        <ExternalLink size={12} className="text-muted-foreground" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
