/**
 * Economically sustainable referral program.
 *
 * Design goals:
 * - Real users only: invitee must trade meaningful volume before fee share accrues
 * - Affordable auto-payouts: modest fee share so platform stays profitable
 * - Anti-sybil: no USD on bare signups; XP-only until qualification
 * - Auto USDC payout once claimable balance clears a minimum
 */
export const REFERRAL_CONFIG = {
    // ── Qualification (invitee must earn their keep) ──────────
    /**
     * Cumulative USD volume the invited wallet must trade (after linking)
     * before ANY fee share or cashback starts accruing.
     */
    minQualifyingVolumeUsd: 100,

    /** Minimum distinct trades after link (in addition to volume). */
    minQualifyingTrades: 2,

    // ── Fee shares (of platform fee only — not of trade notional) ──
    /** Default L1 share of platform fees from a qualified invitee */
    baseL1FeeShare: 0.25, // 25%

    /** L2 (referrer-of-referrer) share — only after invitee qualifies */
    l2FeeShare: 0.05, // 5%

    /** Cap so platform always keeps ≥ 65% of platform fees on referred flow */
    maxTotalFeeShare: 0.35, // L1+L2 max 35%

    /** Invitee cashback of platform fees (after they qualify) */
    refereeCashbackShare: 0.05, // 5%

    /** XP boost for referred traders (all-time while linked; cheap growth lever) */
    refereeXpMultiplier: 1.25,

    // ── XP-only signup (no USD until real volume) ─────────────
    signupBonusReferrerXp: 250,
    signupBonusRefereeXp: 250,

    // ── First qualifying trade (when volume/trades thresholds met) ──
    firstTradeMinVolumeUsd: 100, // same gate as qualification
    firstTradeBonusReferrerXp: 200,
    firstTradeBonusRefereeXp: 200,
    /** Small one-time USD credit when invitee first becomes qualified */
    firstTradeBonusReferrerUsd: 0.25,

    // ── Volume milestones (only count post-qualification volume) ──
    milestones: [
        { volumeUsd: 1_000, bonusXp: 500, bonusUsd: 1 },
        { volumeUsd: 10_000, bonusXp: 2_000, bonusUsd: 5 },
        { volumeUsd: 50_000, bonusXp: 5_000, bonusUsd: 15 },
        { volumeUsd: 250_000, bonusXp: 15_000, bonusUsd: 40 },
    ] as const,

    // ── Affiliate tiers (qualified invites only) ──────────────
    affiliateTiers: [
        { minRefs: 0, feeShare: 0.25, label: "Starter", color: "#94a3b8" },
        { minRefs: 10, feeShare: 0.28, label: "Growth", color: "#22c55e" },
        { minRefs: 50, feeShare: 0.32, label: "Pro", color: "#eab308" },
        { minRefs: 150, feeShare: 0.35, label: "Whale", color: "#a855f7" },
    ] as const,

    // ── Auto-payout (USDC on Solana) ─────────────────────────
    /** Minimum claimable balance to trigger an automatic USDC send */
    minPayoutUsd: 5,

    /** Max single auto-payout (safety clamp) */
    maxPayoutUsd: 500,

    /** Cooldown between auto-payouts per wallet (ms) */
    payoutCooldownMs: 60 * 60 * 1000, // 1 hour

    /** Mint used for payouts */
    payoutMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    payoutDecimals: 6,

    // ── Marketing ────────────────────────────────────────────
    headline: "Earn 25–35% of fees from real traders — paid in USDC",
    subhead:
        "Friends must trade $100+ before you earn. Then you get lifetime fee share, auto-paid in USDC when you hit $5.",
} as const;

export type AffiliateTier = {
    minRefs: number;
    feeShare: number;
    label: string;
    color: string;
};

export function getAffiliateTier(qualifiedReferralCount: number): {
    tier: AffiliateTier;
    next: AffiliateTier | null;
    progress: number;
} {
    const tiers: AffiliateTier[] = [...REFERRAL_CONFIG.affiliateTiers];
    let tier = tiers[0];
    for (let i = tiers.length - 1; i >= 0; i--) {
        if (qualifiedReferralCount >= tiers[i].minRefs) {
            tier = tiers[i];
            break;
        }
    }
    const idx = tiers.findIndex((t) => t.label === tier.label);
    const next = tiers[idx + 1] ?? null;
    let progress = 100;
    if (next) {
        const range = next.minRefs - tier.minRefs;
        progress = Math.min(
            100,
            ((qualifiedReferralCount - tier.minRefs) / Math.max(1, range)) * 100
        );
    }
    return { tier, next, progress };
}

export function getL1FeeShare(qualifiedReferralCount: number): number {
    return getAffiliateTier(qualifiedReferralCount).tier.feeShare;
}
