"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Flame, Activity, Trophy, Users } from "lucide-react";
import { HotPairs } from "@/components/HotPairs";
import { PlatformTape } from "@/components/PlatformTape";
import { WeeklyRace } from "@/components/WeeklyRace";
import { LiveTradersTracker } from "@/components/LiveTradersTracker";
import { PayoutsFeed } from "@/components/PayoutsFeed";
import { SavingsCalculator } from "@/components/SavingsCalculator";
import { QualifyProgress } from "@/components/QualifyProgress";

type Section = "discover" | "proof" | "earn";

/**
 * Mobile-only accordion under the swap terminal — keeps the fold clean
 * while still exposing moat surfaces (tape, race, proof).
 */
export function MobileExplore() {
    const [open, setOpen] = useState<Section | null>("discover");

    const toggle = (s: Section) => setOpen((v) => (v === s ? null : s));

    const sections: {
        id: Section;
        label: string;
        sub: string;
        icon: typeof Flame;
        color: string;
        body: ReactNode;
    }[] = [
        {
            id: "discover",
            label: "Discover",
            sub: "Hot pairs · SHX tape",
            icon: Flame,
            color: "text-orange-400",
            body: (
                <div className="space-y-3">
                    <HotPairs />
                    <PlatformTape />
                </div>
            ),
        },
        {
            id: "proof",
            label: "Live proof",
            sub: "Traders · race · payouts",
            icon: Users,
            color: "text-primary",
            body: (
                <div className="space-y-3">
                    <LiveTradersTracker variant="hero" />
                    <WeeklyRace />
                    <PayoutsFeed />
                </div>
            ),
        },
        {
            id: "earn",
            label: "Earn more",
            sub: "Referrals · savings · qualify",
            icon: Trophy,
            color: "text-yellow-400",
            body: (
                <div className="space-y-3">
                    <QualifyProgress />
                    <SavingsCalculator />
                </div>
            ),
        },
    ];

    return (
        <div className="md:hidden space-y-2 mt-4 pb-4">
            <div className="flex items-center gap-2 px-1 mb-1">
                <Activity size={12} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                    Explore SHX
                </span>
            </div>

            {sections.map((s) => {
                const isOpen = open === s.id;
                const Icon = s.icon;
                return (
                    <div
                        key={s.id}
                        className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                            isOpen
                                ? "border-primary/25 bg-white/[0.04] shadow-[0_0_24px_rgba(34,197,94,0.08)]"
                                : "border-white/8 bg-black/40"
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => toggle(s.id)}
                            className="w-full flex items-center gap-3 px-3.5 py-3.5 text-left active:bg-white/5 transition-colors"
                        >
                            <span
                                className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 ${s.color}`}
                            >
                                <Icon size={16} />
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-bold text-white">
                                    {s.label}
                                </span>
                                <span className="block text-[10px] text-muted-foreground truncate">
                                    {s.sub}
                                </span>
                            </span>
                            <ChevronDown
                                size={16}
                                className={`text-muted-foreground transition-transform duration-300 ${
                                    isOpen ? "rotate-180 text-primary" : ""
                                }`}
                            />
                        </button>
                        <div
                            className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                            }`}
                        >
                            <div className="overflow-hidden">
                                <div className="px-2.5 pb-3 pt-0">{s.body}</div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
