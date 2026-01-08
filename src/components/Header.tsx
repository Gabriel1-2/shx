"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getUserStats } from "@/lib/points";
import { getPlatformStats } from "@/lib/platformStats";

const WalletMultiButton = dynamic(
    () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

export function Header() {
    const { publicKey } = useWallet();
    const [userXP, setUserXP] = useState(0);
    const [platformVolume, setPlatformVolume] = useState(0);

    // Fetch user XP
    useEffect(() => {
        if (publicKey) {
            getUserStats(publicKey.toString()).then(stats => {
                setUserXP(stats.points || 0);
            });
        }
    }, [publicKey]);

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
        <header className="flex h-16 w-full items-center justify-between border-b border-white/10 bg-black/80 px-4 md:px-6 backdrop-blur-xl sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <Link href="/" className="text-2xl font-black tracking-tight">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-lime-400">SHX</span>
                </Link>
                <Link href="/dashboard" className="ml-4 text-sm font-medium text-muted-foreground hover:text-white transition-colors">
                    Dashboard
                </Link>
                <div className="ml-4 hidden md:flex items-center gap-1 rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    </span>
                    Operational
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Platform Stats */}
                <div className="hidden md:flex items-center gap-3 text-xs">
                    <div className="font-mono text-muted-foreground">
                        VOL: <span className="text-white font-bold">{formatVolume(platformVolume)}</span>
                    </div>
                    {publicKey && (
                        <div className="font-mono text-muted-foreground">
                            XP: <span className="text-primary font-bold">{userXP.toLocaleString()}</span>
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
