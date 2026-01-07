/**
 * Fee Tier System for SHX Exchange
 * Fees decrease based on $SHULEVITZ token holdings (in USD value)
 */

export interface FeeTier {
    minHoldingsUSD: number;
    feeBps: number;      // Basis points (50 = 0.50%)
    discount: string;    // Human-readable discount
}

// Fee tiers based on $SHULEVITZ holdings
export const HOLDER_FEE_TIERS: FeeTier[] = [
    { minHoldingsUSD: 750000, feeBps: 5, discount: "−90%" },
    { minHoldingsUSD: 300000, feeBps: 6, discount: "−88%" },
    { minHoldingsUSD: 150000, feeBps: 8, discount: "−84%" },
    { minHoldingsUSD: 60000, feeBps: 12, discount: "−76%" },
    { minHoldingsUSD: 20000, feeBps: 18, discount: "−64%" },
    { minHoldingsUSD: 7500, feeBps: 25, discount: "−50%" },
    { minHoldingsUSD: 2500, feeBps: 35, discount: "−30%" },
    { minHoldingsUSD: 500, feeBps: 45, discount: "−10%" },
    { minHoldingsUSD: 0, feeBps: 50, discount: "—" },
];

// Ape Mode multiplier (50% more fees for priority)
export const APE_MODE_MULTIPLIER = 1.5;

// Shulevitz token = 0% fee (promotional)
export const SHULEVITZ_FEE_BPS = 0;

/**
 * Calculate trading fee based on holdings and mode
 * @param holdingsUSD - USD value of $SHULEVITZ held by wallet
 * @param apeMode - Whether Ape Mode is enabled
 * @param isShulevitzSwap - Whether swapping to $SHULEVITZ (0% promo)
 * @returns Fee in basis points
 */
export function calculateFeeBps(
    holdingsUSD: number,
    apeMode: boolean = false,
    isShulevitzSwap: boolean = false
): number {
    // Shulevitz swap = always 0%
    if (isShulevitzSwap) {
        return SHULEVITZ_FEE_BPS;
    }

    // Find applicable tier (sorted highest to lowest)
    const tier = HOLDER_FEE_TIERS.find(t => holdingsUSD >= t.minHoldingsUSD);
    const baseFee = tier ? tier.feeBps : 50;

    // Apply Ape Mode multiplier
    if (apeMode) {
        return Math.round(baseFee * APE_MODE_MULTIPLIER);
    }

    return baseFee;
}

/**
 * Get the current fee tier for display purposes
 * @param holdingsUSD - USD value of $SHULEVITZ held
 * @returns Current tier info and next tier info
 */
export function getCurrentTier(holdingsUSD: number): {
    current: FeeTier;
    next: FeeTier | null;
    progressToNext: number;
} {
    // Find current tier
    const currentIndex = HOLDER_FEE_TIERS.findIndex(t => holdingsUSD >= t.minHoldingsUSD);
    const current = HOLDER_FEE_TIERS[currentIndex] || HOLDER_FEE_TIERS[HOLDER_FEE_TIERS.length - 1];

    // Next tier is one index lower (higher holdings)
    const next = currentIndex > 0 ? HOLDER_FEE_TIERS[currentIndex - 1] : null;

    // Calculate progress to next tier
    let progressToNext = 100;
    if (next) {
        const range = next.minHoldingsUSD - current.minHoldingsUSD;
        const progress = holdingsUSD - current.minHoldingsUSD;
        progressToNext = Math.min(100, Math.round((progress / range) * 100));
    }

    return { current, next, progressToNext };
}

// Volume milestone requirements for Top 10
export interface VolumeMilestone {
    rank: number;
    minVolumeUSD: number;
    rewardUSD: number;
    nextDayFeeBps: number;
}

export const VOLUME_MILESTONES: VolumeMilestone[] = [
    { rank: 1, minVolumeUSD: 250000, rewardUSD: 1000, nextDayFeeBps: 5 },
    { rank: 2, minVolumeUSD: 200000, rewardUSD: 750, nextDayFeeBps: 6 },
    { rank: 3, minVolumeUSD: 150000, rewardUSD: 600, nextDayFeeBps: 6 },
    { rank: 4, minVolumeUSD: 125000, rewardUSD: 500, nextDayFeeBps: 7 },
    { rank: 5, minVolumeUSD: 100000, rewardUSD: 400, nextDayFeeBps: 7 },
    { rank: 6, minVolumeUSD: 75000, rewardUSD: 300, nextDayFeeBps: 8 },
    { rank: 7, minVolumeUSD: 60000, rewardUSD: 250, nextDayFeeBps: 8 },
    { rank: 8, minVolumeUSD: 50000, rewardUSD: 200, nextDayFeeBps: 8 },
    { rank: 9, minVolumeUSD: 50000, rewardUSD: 200, nextDayFeeBps: 8 },
    { rank: 10, minVolumeUSD: 50000, rewardUSD: 200, nextDayFeeBps: 8 },
];

/**
 * Check if a trader qualifies for milestone rewards
 * @param rank - Leaderboard rank (1-10)
 * @param volumeUSD - Daily trading volume in USD
 * @param tradeCount - Number of trades executed
 * @param totalFeesPaid - Total fees paid in USD
 */
export function checkMilestoneEligibility(
    rank: number,
    volumeUSD: number,
    tradeCount: number,
    totalFeesPaid: number
): { eligible: boolean; reason?: string; reward?: number; nextDayFee?: number } {
    // Must be Top 10
    if (rank < 1 || rank > 10) {
        return { eligible: false, reason: "Not in Top 10" };
    }

    // Minimum 5 trades
    if (tradeCount < 5) {
        return { eligible: false, reason: "Minimum 5 trades required" };
    }

    // Minimum $25 in fees
    if (totalFeesPaid < 25) {
        return { eligible: false, reason: "Minimum $25 in fees required" };
    }

    // Check volume milestone for rank
    const milestone = VOLUME_MILESTONES.find(m => m.rank === rank);
    if (!milestone) {
        return { eligible: false, reason: "Invalid rank" };
    }

    if (volumeUSD < milestone.minVolumeUSD) {
        return {
            eligible: false,
            reason: `Need $${milestone.minVolumeUSD.toLocaleString()} volume (have $${volumeUSD.toLocaleString()})`
        };
    }

    return {
        eligible: true,
        reward: milestone.rewardUSD,
        nextDayFee: milestone.nextDayFeeBps
    };
}
