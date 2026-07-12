"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
    ArrowLeftRight,
    LineChart,
    Rocket,
    Gift,
    User,
} from "lucide-react";

/**
 * Floating glass dock — thumb-zone nav with elevated Pro action.
 */
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
            elevate: false,
        },
        {
            href: "/?tab=markets",
            label: "Markets",
            icon: LineChart,
            active: pathname === "/" && tab === "markets",
            elevate: false,
        },
        {
            href: "/pro",
            label: "Pro",
            icon: Rocket,
            active: pathname === "/pro",
            elevate: true,
        },
        {
            href: "/referrals",
            label: "Earn",
            icon: Gift,
            active: pathname === "/referrals" || pathname === "/earn",
            elevate: false,
        },
        {
            href: "/dashboard",
            label: "You",
            icon: User,
            active:
                pathname === "/dashboard" ||
                pathname === "/buy" ||
                pathname === "/whitepaper",
            elevate: false,
        },
    ];

    return (
        <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-[90] pointer-events-none"
            aria-label="Primary"
        >
            {/* Fade into content */}
            <div className="h-8 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

            <div
                className="pointer-events-auto px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            >
                <div className="mobile-dock mx-auto max-w-md flex items-end justify-between gap-0.5 rounded-[1.75rem] border border-white/10 bg-black/75 backdrop-blur-2xl px-1.5 pt-1.5 pb-1.5 shadow-[0_-8px_40px_rgba(0,0,0,0.55),0_0_0_1px_rgba(34,197,94,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]">
                    {items.map((item) => {
                        if (item.elevate) {
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className="relative flex flex-col items-center justify-center -mt-5 flex-1"
                                >
                                    <span
                                        className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 active:scale-95 ${
                                            item.active
                                                ? "bg-gradient-to-br from-primary to-lime-400 border-primary/50 text-black shadow-[0_8px_28px_rgba(34,197,94,0.55)]"
                                                : "bg-gradient-to-br from-primary/90 to-emerald-600 border-white/10 text-black shadow-[0_6px_20px_rgba(34,197,94,0.35)]"
                                        }`}
                                    >
                                        <item.icon
                                            size={22}
                                            strokeWidth={2.4}
                                        />
                                    </span>
                                    <span
                                        className={`mt-1 text-[9px] font-black tracking-wide ${
                                            item.active
                                                ? "text-primary"
                                                : "text-white/70"
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        }

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`mobile-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 py-2 rounded-2xl transition-all duration-200 active:scale-95 ${
                                    item.active
                                        ? "text-primary"
                                        : "text-white/45 active:text-white"
                                }`}
                            >
                                <span
                                    className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                                        item.active
                                            ? "bg-primary/15 shadow-[0_0_16px_rgba(34,197,94,0.25)]"
                                            : "bg-transparent"
                                    }`}
                                >
                                    <item.icon
                                        size={20}
                                        strokeWidth={item.active ? 2.4 : 2}
                                    />
                                    {item.active && (
                                        <span className="absolute -bottom-0.5 h-0.5 w-3 rounded-full bg-primary" />
                                    )}
                                </span>
                                <span className="text-[9px] font-bold tracking-wide">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
