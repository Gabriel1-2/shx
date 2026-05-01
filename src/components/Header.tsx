"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getUserStats } from "@/lib/points";
import { getPlatformStats } from "@/lib/platformStats";
import { useSHXTier } from "@/hooks/useSHXTier";
import { TierBadge } from "@/components/TierBadge";

const WalletMultiButton = dynamic(
    () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

export function Header() {
    const { publicKey, connected } = useWallet();
    const [platformVolume, setPlatformVolume] = useState(0);
    const tierData = useSHXTier();

    // Fetch platform volume
    useEffect(() => {
        getPlatformStats().then(stats => {
            setPlatformVolume(stats.totalVolume);
        });
    }, []);

    const formatVolume = (vol: number) => {
        if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
        if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
        return `$${vol.toFixed(0)}`;
    };

    return (
        <header className="flex h-14 md:h-16 w-full items-center justify-between border-b border-white/10 bg-black/80 px-3 md:px-6 backdrop-blur-xl sticky top-0 z-50">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-2 min-w-0">
                <Link href="/" className="text-xl md:text-2xl font-black tracking-tight shrink-0">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-lime-400">SHX</span>
                </Link>
                <Link href="/dashboard" className="ml-2 md:ml-4 text-xs md:text-sm font-medium text-muted-foreground hover:text-white transition-colors shrink-0">
                    Dashboard
                </Link>
                <div className="ml-2 md:ml-4 hidden sm:flex items-center gap-1 rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-[9px] md:text-[10px] font-medium text-muted-foreground">
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
