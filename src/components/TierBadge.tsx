"use client";

import { FEE_TIERS, type FeeTier } from "@/lib/feeTiers";

interface TierBadgeProps {
    tier: FeeTier;
    size?: "sm" | "md" | "lg";
    showFee?: boolean;
}

const TIER_GRADIENTS: Record<number, string> = {
    0: "from-gray-500/20 to-gray-600/20 border-gray-500/30",
    1: "from-slate-400/20 to-slate-500/20 border-slate-400/30",
    2: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30",
    3: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30",
    4: "from-purple-500/20 to-pink-500/20 border-purple-500/30",
};

const TIER_TEXT: Record<number, string> = {
    0: "text-gray-400",
    1: "text-slate-300",
    2: "text-yellow-400",
    3: "text-cyan-400",
    4: "text-purple-400",
};

export function TierBadge({ tier, size = "md", showFee = false }: TierBadgeProps) {
    const gradient = TIER_GRADIENTS[tier.tier] || TIER_GRADIENTS[0];
    const textColor = TIER_TEXT[tier.tier] || TIER_TEXT[0];

    const sizeClasses = {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-3 py-1 text-xs",
        lg: "px-4 py-1.5 text-sm",
    };

    return (
        <div className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${gradient} border backdrop-blur-sm ${sizeClasses[size]}`}>
            <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tier.color }}
            />
            <span className={`font-bold ${textColor}`}>
                {tier.label}
            </span>
            {showFee && (
                <span className={`${textColor} opacity-70`}>
                    {tier.feePercent}%
                </span>
            )}
        </div>
    );
}
