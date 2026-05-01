import { SHULEVITZ_MINT } from "./constants";

// ──────────────────────────────────────────────────────────────
// FEE TIER SYSTEM — Rewards SHX holders with lower fees
// ──────────────────────────────────────────────────────────────
// Jupiter referral fees range: 50-255 bps (0.50% to 2.55%)
// Buying SHX = 0% platform fee (only Jupiter + LP fees apply)
// ──────────────────────────────────────────────────────────────

export interface FeeTier {
    tier: number;
    minSHX: number;
    feeBps: number;     // basis points (65 = 0.65%)
    feePercent: number; // human-readable (0.65)
    label: string;
    color: string;      // for UI badges
}

export const FEE_TIERS: FeeTier[] = [
    { tier: 0, minSHX: 0,         feeBps: 65, feePercent: 0.65, label: "Base",     color: "#6b7280" },
    { tier: 1, minSHX: 10_000,    feeBps: 60, feePercent: 0.60, label: "Silver",   color: "#94a3b8" },
    { tier: 2, minSHX: 50_000,    feeBps: 55, feePercent: 0.55, label: "Gold",     color: "#eab308" },
    { tier: 3, minSHX: 100_000,   feeBps: 52, feePercent: 0.52, label: "Platinum", color: "#06b6d4" },
    { tier: 4, minSHX: 500_000,   feeBps: 50, feePercent: 0.50, label: "Diamond",  color: "#a855f7" },
];

/**
 * Get the fee tier for a given SHX balance.
 * Returns the tier info + next tier progress data.
 */
export function getTierForBalance(shxBalance: number): {
    tier: FeeTier;
    nextTier: FeeTier | null;
    shxNeeded: number;
    progress: number; // 0-100
} {
    let currentTier = FEE_TIERS[0];

    for (let i = FEE_TIERS.length - 1; i >= 0; i--) {
        if (shxBalance >= FEE_TIERS[i].minSHX) {
            currentTier = FEE_TIERS[i];
            break;
        }
    }

    const nextTierIndex = currentTier.tier + 1;
    const nextTier = nextTierIndex < FEE_TIERS.length ? FEE_TIERS[nextTierIndex] : null;

    let shxNeeded = 0;
    let progress = 100;

    if (nextTier) {
        shxNeeded = Math.max(0, nextTier.minSHX - shxBalance);
        const rangeStart = currentTier.minSHX;
        const rangeEnd = nextTier.minSHX;
        progress = Math.min(100, Math.max(0,
            ((shxBalance - rangeStart) / (rangeEnd - rangeStart)) * 100
        ));
    }

    return { tier: currentTier, nextTier, shxNeeded, progress };
}

/**
 * Check if the swap is buying SHX (output mint is SHULEVITZ).
 * When buying SHX, the platform fee is 0%.
 */
export function isSHXBuy(outputMint: string): boolean {
    return outputMint === SHULEVITZ_MINT;
}

/**
 * Get the effective fee BPS for a swap.
 * Returns 0 if buying SHX, otherwise the tier fee.
 */
export function getEffectiveFeeBps(shxBalance: number, outputMint: string): number {
    if (isSHXBuy(outputMint)) return 0;
    return getTierForBalance(shxBalance).tier.feeBps;
}

/**
 * Weekly leaderboard reward distribution
 */
export const WEEKLY_REWARD_POOL_USD = 500;
export const MIN_WEEKLY_VOLUME_USD = 1000;

export const REWARD_DISTRIBUTION = [
    0.25,  // #1 → 25%
    0.15,  // #2 → 15%
    0.10,  // #3 → 10%
    0.0714, // #4 → ~7.14%
    0.0714, // #5
    0.0714, // #6
    0.0714, // #7
    0.0714, // #8
    0.0714, // #9
    0.0714, // #10
];

export function getEstimatedReward(rank: number): number {
    if (rank < 1 || rank > 10) return 0;
    return WEEKLY_REWARD_POOL_USD * REWARD_DISTRIBUTION[rank - 1];
}
