"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
    ArrowLeftRight, BarChart3, LineChart, Rocket, Gift, Wallet,
} from "lucide-react";

export function MobileNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const tab = searchParams.get("tab");

    const items = [
        {
            href: "/",
            label: "Swap",
            icon: ArrowLeftRight,
            active: pathname === "/" && tab !== "markets",
        },
        {
            href: "/pro",
            label: "Pro",
            icon: Rocket,
            active: pathname === "/pro",
        },
        {
            href: "/?tab=markets",
            label: "Markets",
            icon: LineChart,
            active: pathname === "/" && tab === "markets",
        },
        {
            href: "/referrals",
            label: "Refer",
            icon: Gift,
            active: pathname === "/referrals",
        },
        {
            href: "/dashboard",
            label: "Stats",
            icon: BarChart3,
            active: pathname === "/dashboard",
        },
        {
            href: "/buy",
            label: "Buy",
            icon: Wallet,
            active: pathname === "/buy",
        },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-around px-1 py-2">
                {items.map((item) => (
                    <Link
                        key={item.href + item.label}
                        href={item.href}
                        className={`flex flex-col items-center gap-0.5 w-14 transition-colors ${
                            item.active
                                ? "text-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                                : "text-muted-foreground hover:text-white"
                        }`}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="text-[9px] font-bold">{item.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
