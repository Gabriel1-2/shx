"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getUserStats } from "@/lib/points";
import { getPlatformStats } from "@/lib/platformStats";
import { useSHXTier } from "@/hooks/useSHXTier";
import { TierBadge } from "@/components/TierBadge";
import { InstallAppButton } from "@/components/InstallAppButton";

const WalletMultiButton = dynamic(
    () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

export function Header() {
    const { publicKey, connected } = useWallet();
    const [platformVolume, setPlatformVolume] = useState(0);
    const tierData = useSHXTier();

    // Fetch platform volume + refresh on swap events
    useEffect(() => {
        const fetchVolume = () => {
            getPlatformStats().then(stats => {
                setPlatformVolume(stats.totalVolume);
            });
        };

        fetchVolume();

        // Refresh every 30 seconds
        const interval = setInterval(fetchVolume, 30000);

        // Listen for swap events from JupiterTerminal
        const handleSwap = () => {
            setTimeout(fetchVolume, 8000);
            setTimeout(fetchVolume, 20000);
        };
        window.addEventListener("shx-swap-success", handleSwap);

        return () => {
            clearInterval(interval);
            window.removeEventListener("shx-swap-success", handleSwap);
        };
    }, []);

    const formatVolume = (vol: number) => {
        if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
        if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
        return `$${vol.toFixed(0)}`;
    };

    return (
        <header className="flex h-14 md:h-16 w-full items-center justify-between border-b border-white/10 bg-black/80 px-3 md:px-6 backdrop-blur-xl sticky top-0 z-[100]">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-1 md:gap-2 min-w-0 overflow-x-auto scrollbar-hide">
                <Link href="/" className="text-xl md:text-2xl font-black tracking-tight shrink-0">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-lime-400">SHX</span>
                </Link>
                <nav className="hidden md:flex items-center gap-1 ml-4">
                    <Link href="/pro" className="px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors shrink-0 border border-white/10">
                        Pro
                    </Link>
                    <Link href="/earn" className="px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold text-green-400 hover:text-green-300 transition-colors shrink-0">
                        Earn
                    </Link>
                    <Link href="/buy" className="px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors shrink-0">
                        Buy
                    </Link>
                    <Link href="/dashboard" className="px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium text-muted-foreground hover:text-white transition-colors shrink-0">
                        Stats
                    </Link>
                    <Link href="/whitepaper" className="px-2 md:px-3 py-1 text-[10px] md:text-xs font-medium text-muted-foreground hover:text-white transition-colors shrink-0">
                        Paper
                    </Link>
                </nav>
                <div className="ml-1 md:ml-2 hidden sm:flex items-center gap-1 rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-[9px] md:text-[10px] font-medium text-muted-foreground shrink-0">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    </span>
                    Live
                </div>
            </div>

            {/* Right: Stats + Wallet */}
            <div className="flex items-center gap-2 md:gap-3">
                {/* Tier Badge (mobile + desktop) */}
                {connected && (
                    <TierBadge tier={tierData.tier} size="sm" />
                )}

                {/* Install App Button (PWA) */}
                <InstallAppButton />

                {/* Platform Stats (desktop only) */}
                <div className="hidden md:flex items-center gap-3 text-xs">
                    <div className="font-mono text-muted-foreground">
                        VOL: <span className="text-white font-bold">{formatVolume(platformVolume)}</span>
                    </div>
                    {connected && (
                        <div className="font-mono text-muted-foreground">
                            FEE: <span className="text-primary font-bold">{tierData.feePercent}%</span>
                        </div>
                    )}
                </div>

                {/* Wallet Button */}
                <div className="shx-wallet-adapter">
                    <WalletMultiButton />
                </div>
            </div>
        </header>
    );
}
