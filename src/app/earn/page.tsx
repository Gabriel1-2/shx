"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { 
    Coins, 
    Droplets, 
    ExternalLink, 
    ArrowRight, 
    TrendingUp, 
    ShieldCheck, 
    Zap,
    Lock
} from "lucide-react";
import { SHULEVITZ_MINT } from "@/lib/constants";

export default function EarnPage() {
    const { connected } = useWallet();
    const [activeTab, setActiveTab] = useState<"raydium" | "orca">("raydium");

    // Live data for the pitch (we can wire this to real on-chain data later)
    const SHX_LIQUIDITY = 44000; 
    const SHX_PRICE = 0.0012; // Example price
    const APY = 152.4; 

    return (
        <main className="min-h-screen bg-background relative overflow-hidden py-12 px-4 md:px-8">
            {/* Background effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-green-500/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="max-w-5xl mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold mb-6">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                        </span>
                        SHX LIQUIDITY MINING IS LIVE
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4">
                        Provide Liquidity. <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
                            Earn {APY}% APY.
                        </span>
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Deposit your SHX and SOL into decentralized liquidity pools to earn massive yields from trading fees and protocol emissions.
                    </p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                    {[
                        { label: "Total Value Locked", value: `$${SHX_LIQUIDITY.toLocaleString()}`, icon: Lock },
                        { label: "Current APY", value: `${APY}%`, icon: TrendingUp, color: "text-green-400" },
                        { label: "24h Fees Earned", value: "$425.50", icon: Coins },
                        { label: "Platform Risk", value: "Minimal", icon: ShieldCheck, color: "text-blue-400" },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                <stat.icon size={16} className={stat.color || "text-muted-foreground"} />
                                <span className="text-xs uppercase font-bold tracking-wider">{stat.label}</span>
                            </div>
                            <div className={`text-2xl font-black ${stat.color || "text-white"}`}>
                                {stat.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Action Area */}
                <div className="grid md:grid-cols-3 gap-8">
                    {/* Left: Pool Selection */}
                    <div className="md:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Droplets className="text-primary" /> Active Pools
                        </h2>
                        
                        {/* Raydium Pool Card */}
                        <div className={`rounded-2xl border transition-all duration-300 p-6 ${activeTab === "raydium" ? "bg-black/60 border-primary shadow-[0_0_30px_rgba(var(--primary),0.15)]" : "bg-black/40 border-white/10 hover:border-white/20 cursor-pointer"}`}
                            onClick={() => setActiveTab("raydium")}
                        >
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex -space-x-2">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center border-2 border-black z-10">
                                            <span className="text-[10px] font-black text-black">SHX</span>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center border-2 border-black">
                                            <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="SOL" className="w-full h-full rounded-full" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            SHX-SOL 
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">Raydium</span>
                                        </h3>
                                        <p className="text-sm text-muted-foreground">Fee Tier: 0.25%</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground mb-1">TVL</p>
                                        <p className="font-mono text-white font-bold">${SHX_LIQUIDITY.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground mb-1">APY</p>
                                        <p className="font-mono text-green-400 font-bold">{APY}%</p>
                                    </div>
                                </div>
                            </div>

                            {activeTab === "raydium" && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 flex items-start gap-3">
                                        <Zap className="text-primary shrink-0 mt-0.5" size={18} />
                                        <div className="text-sm text-primary-foreground/80">
                                            Providing liquidity on Raydium helps stabilize the SHX token and earns you a cut of every trade made on the network.
                                        </div>
                                    </div>
                                    <a 
                                        href={`https://raydium.io/liquidity/add/?ammId=YOUR_AMM_ID_HERE&coin0=So11111111111111111111111111111111111111112&coin1=${SHULEVITZ_MINT}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)]"
                                    >
                                        Deposit on Raydium <ExternalLink size={16} />
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Orca Pool Card (Coming Soon) */}
                        <div className="rounded-2xl border border-white/5 bg-black/20 p-6 opacity-60">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex -space-x-2 grayscale">
                                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border-2 border-black z-10">
                                            <span className="text-[10px] font-black text-gray-500">SHX</span>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-gray-900 border-2 border-black" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-500 flex items-center gap-2">
                                            SHX-USDC
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-gray-500">Orca Whirlpool</span>
                                        </h3>
                                        <p className="text-sm text-gray-600">Coming Soon</p>
                                    </div>
                                </div>
                                <div className="px-3 py-1 rounded bg-white/5 text-xs text-gray-500 font-bold border border-white/5">
                                    Upcoming
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Info / Instructions */}
                    <div className="space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">How it works</h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                                    <p className="text-sm text-muted-foreground">Click "Deposit on Raydium" to open the decentralized liquidity pool interface.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                                    <p className="text-sm text-muted-foreground">Provide an equal value of SHX and SOL tokens into the smart contract.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                                    <p className="text-sm text-muted-foreground">Receive LP tokens representing your share of the pool.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</div>
                                    <p className="text-sm text-muted-foreground"><strong className="text-white">Earn Fees!</strong> Automatically accrue trading fees on every swap made through SHX Exchange and Raydium.</p>
                                </li>
                            </ul>
                        </div>

                        {!connected && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 text-center">
                                <WalletIcon className="mx-auto text-blue-400 mb-3" size={32} />
                                <h4 className="text-white font-bold mb-2">Connect Wallet</h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Connect your Solana wallet to manage your liquidity positions and claim rewards.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

function WalletIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-8 8H5a2 2 0 0 1-2-2V8" />
            <polyline points="20 12 20 12 20 12" />
        </svg>
    )
}
