"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSHXTier } from "@/hooks/useSHXTier";
import { TierBadge } from "@/components/TierBadge";
import { InstallAppButton } from "@/components/InstallAppButton";
import { LiveTradersTracker } from "@/components/LiveTradersTracker";
import { Sparkles } from "lucide-react";
import { SHULEVITZ_MINT } from "@/lib/constants";
import { useStore } from "@/store";

const WalletMultiButton = dynamic(
    () =>
        import("@solana/wallet-adapter-react-ui").then(
            (mod) => mod.WalletMultiButton
        ),
    { ssr: false }
);

export function Header() {
    const { connected } = useWallet();
    const tierData = useSHXTier();
    const { setPreferredOutputMint, setChartToken } = useStore();

    return (
        <header className="mobile-header sticky top-0 z-[100] w-full border-b border-white/10 bg-black/75 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/60 pt-[env(safe-area-inset-top)]">
            <div className="flex h-12 md:h-16 w-full items-center justify-between px-3 md:px-6">
                {/* Left: Logo — clean on mobile */}
                <div className="flex items-center gap-2 min-w-0">
                    <Link
                        href="/"
                        className="flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
                    >
                        <span className="relative flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-lime-400/10 border border-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.25)]">
                            <span className="text-sm md:text-base font-black text-transparent bg-clip-text bg-gradient-to-br from-primary to-lime-300">
                                S
                            </span>
                        </span>
                        <span className="text-lg md:text-2xl font-black tracking-tight">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-lime-400">
                                SHX
                            </span>
                        </span>
                    </Link>

                    {/* Desktop nav only */}
                    <nav className="hidden md:flex items-center gap-1.5 ml-3">
                        <Link
                            href="/pro"
                            className="px-3 py-1.5 text-xs font-bold text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                        >
                            Pro
                        </Link>
                        <Link
                            href="/earn"
                            className="px-3 py-1.5 text-xs font-bold text-green-400 hover:text-green-300 transition-colors"
                        >
                            Earn
                        </Link>
                        <Link
                            href="/buy"
                            className="px-3 py-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            Buy
                        </Link>
                        <Link
                            href="/referrals"
                            className="px-3 py-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            Refer
                        </Link>
                        <Link
                            href="/dashboard"
                            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            Stats
                        </Link>
                        <Link
                            href="/whitepaper"
                            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            Paper
                        </Link>
                        <div className="ml-1 flex items-center gap-1 rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                            </span>
                            Live
                        </div>
                    </nav>
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-1.5 md:gap-3">
                    {/* Mobile: one-tap Buy SHX chip */}
                    <Link
                        href={`/?output=${SHULEVITZ_MINT}&focus=shx`}
                        onClick={() => {
                            setChartToken({ address: SHULEVITZ_MINT, symbol: "SHX" });
                            setPreferredOutputMint(SHULEVITZ_MINT);
                        }}
                        className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-black active:scale-95 transition-transform"
                    >
                        <Sparkles size={11} />
                        0%
                    </Link>

                    {connected && (
                        <div className="hidden xs:block sm:block">
                            <TierBadge tier={tierData.tier} size="sm" />
                        </div>
                    )}

                    <div className="hidden sm:block">
                        <InstallAppButton />
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-xs">
                        <LiveTradersTracker variant="compact" />
                        {connected && (
                            <div className="font-mono text-muted-foreground hidden md:block">
                                FEE:{" "}
                                <span className="text-primary font-bold">
                                    {tierData.feePercent}%
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="shx-wallet-adapter">
                        <WalletMultiButton />
                    </div>
                </div>
            </div>
        </header>
    );
}
