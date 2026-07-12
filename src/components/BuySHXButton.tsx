"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SHULEVITZ_MINT } from "@/lib/constants";
import { useStore } from "@/store";

/**
 * One-tap path to 0% platform fee SHX buy — unique vs every competitor.
 */
export function BuySHXButton({
    size = "md",
    className = "",
}: {
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    const { setChartToken, setChartVisible, setPreferredOutputMint } = useStore();

    const pad =
        size === "lg"
            ? "px-6 py-3.5 text-sm"
            : size === "sm"
              ? "px-3 py-1.5 text-[10px]"
              : "px-4 py-2.5 text-xs";

    return (
        <Link
            href={`/?output=${SHULEVITZ_MINT}&focus=shx`}
            onClick={() => {
                setChartToken({ address: SHULEVITZ_MINT, symbol: "SHX" });
                setPreferredOutputMint(SHULEVITZ_MINT);
                setChartVisible(true);
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-black bg-gradient-to-r from-primary to-lime-400 text-black shadow-[0_0_24px_rgba(34,197,94,0.35)] hover:opacity-90 transition-all ${pad} ${className}`}
        >
            <Sparkles size={size === "sm" ? 12 : 14} />
            Buy SHX · 0% fee
        </Link>
    );
}
