"use client";

import Link from "next/link";
import { Button } from "./ui/Button";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
    () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

export function Header() {
    return (
        <header className="flex h-20 w-full items-center justify-between border-b border-white/10 bg-black/50 px-6 backdrop-blur-md">
            <div className="flex items-center gap-2">
                <Link href="/" className="text-2xl font-black tracking-tighter text-primary">
                    SHX<span className="text-white">.APP</span>
                </Link>
                <Link href="/dashboard" className="ml-4 text-sm font-medium text-muted-foreground hover:text-white">
                    Dashboard
                </Link>
                <div className="ml-4 flex items-center gap-1 rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                    </span>
                    System Operational
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Points/Stats Teaser - Hidden on mobile for MVP */}
                <div className="hidden items-center gap-4 md:flex">
                    <div className="text-sm font-mono text-muted-foreground">
                        VOL: <span className="text-white">$24.5M</span>
                    </div>
                    <div className="text-sm font-mono text-muted-foreground">
                        XP: <span className="text-primary">0</span>
                    </div>
                </div>

                {/* Custom style for Wallet Button via wrapper or global css override */}
                <div className="shx-wallet-adapter">
                    <WalletMultiButton style={{ backgroundColor: 'hsl(var(--primary))', color: 'black', fontFamily: 'inherit', fontWeight: 'bold' }} />
                </div>
            </div>
        </header>
    );
}
