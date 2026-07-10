/**
 * Growth-oriented referral economics.
 * Platform keeps residual fees; referrers + referees get aggressive rewards
 * so sharing SHX is clearly the highest-ROI growth loop.
 */
export const REFERRAL_CONFIG = {
    /** Lifetime share of platform fees paid to the direct referrer (L1) */
    baseL1FeeShare: 0.5, // 50%

    /** Share paid to L2 (referrer of the referrer), if any */
    l2FeeShare: 0.1, // 10%

    /** Max combined L1+L2 so platform always keeps a floor */
    maxTotalFeeShare: 0.65, // 65% of fees max → platform keeps ≥35%

    /** Referee (invited user) gets this share of fees as cashback credit */
    refereeCashbackShare: 0.15, // 15% of fees back as claimable credit

    /** Extra XP multiplier for referred traders (all-time while linked) */
    refereeXpMultiplier: 1.5,

    /** One-time XP when wallet connects with a valid ref link */
    signupBonusReferrerXp: 1_500,
    signupBonusRefereeXp: 750,

    /** First qualifying trade bonuses (both sides) */
    firstTradeMinVolumeUsd: 10,
    firstTradeBonusReferrerXp: 500,
    firstTradeBonusRefereeXp: 500,
    firstTradeBonusReferrerUsd: 0.5, // tracked claimable credit

    /** Volume milestones on a single referred trader → extra referrer rewards */
    milestones: [
        { volumeUsd: 1_000, bonusXp: 1_000, bonusUsd: 2 },
        { volumeUsd: 10_000, bonusXp: 5_000, bonusUsd: 15 },
        { volumeUsd: 50_000, bonusXp: 20_000, bonusUsd: 50 },
        { volumeUsd: 250_000, bonusXp: 75_000, bonusUsd: 200 },
    ] as const,

    /**
     * Affiliate tiers: more active referrals → higher L1 fee share.
     * Count is lifetime successful referred wallets.
     */
    affiliateTiers: [
        { minRefs: 0, feeShare: 0.5, label: "Starter", color: "#94a3b8" },
        { minRefs: 5, feeShare: 0.55, label: "Growth", color: "#22c55e" },
        { minRefs: 25, feeShare: 0.6, label: "Pro", color: "#eab308" },
        { minRefs: 100, feeShare: 0.65, label: "Whale", color: "#a855f7" },
    ] as const,

    /** Marketing copy for UI */
    headline: "Earn up to 65% of every fee your network pays — forever",
    subhead:
        "Lifetime rev-share on friends you bring. They get 1.5× XP + fee cashback. You stack cash credits and climb affiliate tiers.",
} as const;

export type AffiliateTier = {
    minRefs: number;
    feeShare: number;
    label: string;
    color: string;
};

export function getAffiliateTier(referralCount: number): {
    tier: AffiliateTier;
    next: AffiliateTier | null;
    progress: number;
} {
    const tiers: AffiliateTier[] = [...REFERRAL_CONFIG.affiliateTiers];
    let tier = tiers[0];
    for (let i = tiers.length - 1; i >= 0; i--) {
        if (referralCount >= tiers[i].minRefs) {
            tier = tiers[i];
            break;
        }
    }
    const idx = tiers.findIndex((t) => t.label === tier.label);
    const next = tiers[idx + 1] ?? null;
    let progress = 100;
    if (next) {
        const range = next.minRefs - tier.minRefs;
        progress = Math.min(100, ((referralCount - tier.minRefs) / Math.max(1, range)) * 100);
    }
    return { tier, next, progress };
}

export function getL1FeeShare(referralCount: number): number {
    return getAffiliateTier(referralCount).tier.feeShare;
}
