"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";

/**
 * Compact sticky-feel page title for mobile secondary routes.
 */
export function MobilePageHeader({
    title,
    subtitle,
    icon: Icon,
    backHref = "/",
    right,
}: {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    backHref?: string;
    right?: ReactNode;
}) {
    return (
        <div className="md:hidden mb-4">
            <div className="flex items-center gap-2.5">
                <Link
                    href={backHref}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 active:scale-95 active:bg-white/10 transition-all"
                    aria-label="Back"
                >
                    <ChevronLeft size={18} />
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        {Icon && (
                            <Icon size={14} className="text-primary shrink-0" />
                        )}
                        <h1 className="text-base font-black text-white truncate tracking-tight">
                            {title}
                        </h1>
                    </div>
                    {subtitle && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
                {right && <div className="shrink-0">{right}</div>}
            </div>
        </div>
    );
}
