"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeftRight, BarChart3, LineChart } from "lucide-react";

export function MobileNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const tab = searchParams.get("tab");

    const isSwap = pathname === "/" && tab !== "markets";
    const isMarkets = pathname === "/" && tab === "markets";
    const isStats = pathname === "/dashboard";

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/10 pb-safe pb-1">
            <div className="flex items-center justify-around px-2 py-3">
                <Link 
                    href="/" 
                    className={`flex flex-col items-center gap-1 w-16 transition-colors ${isSwap ? "text-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "text-muted-foreground hover:text-white"}`}
                >
                    <ArrowLeftRight className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Swap</span>
                </Link>
                
                <Link 
                    href="/?tab=markets" 
                    className={`flex flex-col items-center gap-1 w-16 transition-colors ${isMarkets ? "text-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "text-muted-foreground hover:text-white"}`}
                >
                    <LineChart className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Markets</span>
                </Link>

                <Link 
                    href="/dashboard" 
                    className={`flex flex-col items-center gap-1 w-16 transition-colors ${isStats ? "text-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "text-muted-foreground hover:text-white"}`}
                >
                    <BarChart3 className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Stats</span>
                </Link>
            </div>
        </div>
    );
}
