/**
 * Server-side referral engine — Firestore Admin + volume qualification + auto-payout.
 */
import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import {
    REFERRAL_CONFIG,
    getAffiliateTier,
    getL1FeeShare,
} from "./referralConfig";
import { tryAutoPayout } from "./referralPayout";

export function generateReferralCode(wallet: string): string {
    return `SHX-${wallet.slice(0, 4)}${wallet.slice(-4)}`.toUpperCase();
}

function normalizeCode(code: string): string {
    return code.trim().toUpperCase().replace(/^REF[-_]?/, "SHX-");
}

export async function adminInitializeReferralCode(wallet: string): Promise<string> {
    const code = generateReferralCode(wallet);
    if (!adminDb) return code;

    try {
        const userRef = adminDb.collection("users").doc(wallet);
        const snap = await userRef.get();
        const existing = snap.exists
            ? (snap.data()?.referralCode as string | undefined)
            : undefined;
        const finalCode = existing || code;

        if (!existing) {
            await userRef.set(
                {
                    wallet,
                    referralCode: finalCode,
                    referralCount: 0,
                    qualifiedReferralCount: 0,
                    referralEarnings: 0,
                    referralClaimableUsd: 0,
                    referralPaidUsd: 0,
                    referralVolumeGenerated: 0,
                },
                { merge: true }
            );
        }

        await adminDb.collection("referral_codes").doc(finalCode).set(
            { code: finalCode, wallet, updatedAt: new Date().toISOString() },
            { merge: true }
        );

        return finalCode;
    } catch (e) {
        console.error("[referral] init code", e);
        return code;
    }
}

async function resolveCodeToWallet(code: string): Promise<string | null> {
    if (!adminDb) return null;
    const normalized = normalizeCode(code);

    const idx = await adminDb.collection("referral_codes").doc(normalized).get();
    if (idx.exists && idx.data()?.wallet) return idx.data()!.wallet as string;

    const snap = await adminDb
        .collection("users")
        .where("referralCode", "==", normalized)
        .limit(1)
        .get();
    if (!snap.empty) {
        const wallet = snap.docs[0].id;
        await adminDb.collection("referral_codes").doc(normalized).set(
            { code: normalized, wallet, updatedAt: new Date().toISOString() },
            { merge: true }
        );
        return wallet;
    }
    return null;
}

export async function adminRegisterReferral(
    newUserWallet: string,
    referralCode: string
): Promise<{
    success: boolean;
    reason?: string;
    referrer?: string;
    signupBonus?: { referrerXp: number; refereeXp: number };
}> {
    if (!adminDb) return { success: false, reason: "Database unavailable" };

    try {
        const referrerWallet = await resolveCodeToWallet(referralCode);
        if (!referrerWallet) return { success: false, reason: "Invalid referral code" };
        if (referrerWallet === newUserWallet) {
            return { success: false, reason: "Cannot refer yourself" };
        }

        const newUserRef = adminDb.collection("users").doc(newUserWallet);
        const existing = await newUserRef.get();
        if (existing.exists && existing.data()?.referredBy) {
            return {
                success: false,
                reason: "Already referred",
                referrer: existing.data()!.referredBy,
            };
        }

        const referrerDoc = await adminDb.collection("users").doc(referrerWallet).get();
        const l2 = (referrerDoc.data()?.referredBy as string | undefined) || null;

        // Snapshot volume at link so only post-link trading counts toward qualification
        const volumeAtLink = Number(existing.data()?.volume || 0);
        const tradesAtLink = Number(existing.data()?.tradeCount || 0);

        const signupReferrerXp = REFERRAL_CONFIG.signupBonusReferrerXp;
        const signupRefereeXp = REFERRAL_CONFIG.signupBonusRefereeXp;

        await adminDb.runTransaction(async (t) => {
            t.set(
                newUserRef,
                {
                    wallet: newUserWallet,
                    referredBy: referrerWallet,
                    referredByL2: l2,
                    referralCodeUsed: normalizeCode(referralCode),
                    referralDate: new Date().toISOString(),
                    volumeAtReferralLink: volumeAtLink,
                    tradesAtReferralLink: tradesAtLink,
                    postLinkVolume: 0,
                    postLinkTrades: 0,
                    referralQualified: false,
                    points: FieldValue.increment(signupRefereeXp),
                    referralCashbackEarned: 0,
                    isReferred: true,
                    firstTradeBonusClaimed: false,
                    lastActive: new Date().toISOString(),
                },
                { merge: true }
            );

            t.set(
                adminDb!.collection("users").doc(referrerWallet),
                {
                    referralCount: FieldValue.increment(1),
                    points: FieldValue.increment(signupReferrerXp),
                    lastReferralAt: new Date().toISOString(),
                    wallet: referrerWallet,
                },
                { merge: true }
            );
        });

        await adminDb.collection("referral_events").add({
            type: "signup",
            referrer: referrerWallet,
            referee: newUserWallet,
            l2,
            referrerXp: signupReferrerXp,
            refereeXp: signupRefereeXp,
            code: normalizeCode(referralCode),
            note: `No fee share until invitee trades $${REFERRAL_CONFIG.minQualifyingVolumeUsd}+ (${REFERRAL_CONFIG.minQualifyingTrades} trades)`,
            timestamp: FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString(),
        });

        await adminInitializeReferralCode(newUserWallet);
        await adminInitializeReferralCode(referrerWallet);

        return {
            success: true,
            referrer: referrerWallet,
            signupBonus: { referrerXp: signupReferrerXp, refereeXp: signupRefereeXp },
        };
    } catch (e) {
        console.error("[referral] register", e);
        return { success: false, reason: "Database error" };
    }
}

export interface TradeReferralResult {
    credited: boolean;
    qualified: boolean;
    l1Usd: number;
    l2Usd: number;
    refereeCashbackUsd: number;
    referrerXp: number;
    refereeXpBonus: number;
    milestonesHit: number[];
    postLinkVolume: number;
    payout?: unknown;
}

/**
 * Credit referral rewards for a completed trade.
 * Fee USD only accrues after invitee hits volume + trade qualification.
 * Idempotent via referral_events doc id = `trade-{eventId}`.
 */
export async function adminCreditTradeReferral(params: {
    eventId: string;
    traderWallet: string;
    feeUsd: number;
    volumeUsd: number;
    source: "swap" | "limit" | "dca" | "agent";
}): Promise<TradeReferralResult> {
    const empty: TradeReferralResult = {
        credited: false,
        qualified: false,
        l1Usd: 0,
        l2Usd: 0,
        refereeCashbackUsd: 0,
        referrerXp: 0,
        refereeXpBonus: 0,
        milestonesHit: [],
        postLinkVolume: 0,
    };

    if (!adminDb || (params.feeUsd <= 0 && params.volumeUsd <= 0)) return empty;

    const eventRef = adminDb.collection("referral_events").doc(`trade-${params.eventId}`);
    try {
        if ((await eventRef.get()).exists) return empty;

        const traderRef = adminDb.collection("users").doc(params.traderWallet);
        const traderSnap = await traderRef.get();
        const trader = traderSnap.data() || {};
        const l1 = trader.referredBy as string | undefined;
        if (!l1) return empty;

        const l2 = (trader.referredByL2 as string | undefined) || null;
        const vol = Math.max(0, params.volumeUsd);
        const fee = Math.max(0, params.feeUsd);

        // Post-link volume accounting (volume field may already include this trade)
        const volumeAtLink = Number(trader.volumeAtReferralLink || 0);
        const tradesAtLink = Number(trader.tradesAtReferralLink || 0);
        const totalVolume = Number(trader.volume || 0);
        const totalTrades = Number(trader.tradeCount || 0);

        // Prefer explicit postLink counters + this trade
        let postLinkVolume = Number(trader.postLinkVolume || 0) + vol;
        let postLinkTrades = Number(trader.postLinkTrades || 0) + 1;

        // If counters never set, derive from totals
        if (!trader.postLinkVolume && trader.volumeAtReferralLink != null) {
            postLinkVolume = Math.max(0, totalVolume - volumeAtLink);
            // Ensure this trade is included
            if (postLinkVolume < vol) postLinkVolume = vol;
        }
        if (!trader.postLinkTrades && trader.tradesAtReferralLink != null) {
            postLinkTrades = Math.max(1, totalTrades - tradesAtLink);
        }

        const wasQualified = !!trader.referralQualified;
        const nowQualified =
            postLinkVolume >= REFERRAL_CONFIG.minQualifyingVolumeUsd &&
            postLinkTrades >= REFERRAL_CONFIG.minQualifyingTrades;

        // Always track post-link volume; XP boost can apply pre-qualification
        const baseXp = Math.max(1, Math.floor(vol));
        const refereeXpBonus = Math.floor(
            baseXp * (REFERRAL_CONFIG.refereeXpMultiplier - 1)
        );
        // Small XP for referrer even before qualify (engagement, not cash)
        let referrerXp = nowQualified ? Math.floor(vol * 0.25) : Math.floor(vol * 0.05);

        let l1Usd = 0;
        let l2Usd = 0;
        let refereeCashbackUsd = 0;
        let l1Share = 0;
        let l2Share = 0;
        let firstQualify = false;
        const milestonesHit: number[] = [];
        const claimed: number[] = (trader.referralMilestonesClaimed as number[]) || [];

        if (nowQualified) {
            const l1User = (await adminDb.collection("users").doc(l1).get()).data() || {};
            const qualifiedCount = Number(l1User.qualifiedReferralCount || 0);
            l1Share = getL1FeeShare(qualifiedCount);
            l2Share = l2 ? REFERRAL_CONFIG.l2FeeShare : 0;
            if (l1Share + l2Share > REFERRAL_CONFIG.maxTotalFeeShare) {
                l2Share = Math.max(0, REFERRAL_CONFIG.maxTotalFeeShare - l1Share);
            }

            l1Usd = fee * l1Share;
            l2Usd = l2 ? fee * l2Share : 0;
            refereeCashbackUsd = fee * REFERRAL_CONFIG.refereeCashbackShare;

            // First time crossing qualification gate
            if (!wasQualified) {
                firstQualify = true;
                referrerXp += REFERRAL_CONFIG.firstTradeBonusReferrerXp;
                l1Usd += REFERRAL_CONFIG.firstTradeBonusReferrerUsd;
            }

            // Milestones on post-link volume
            for (const m of REFERRAL_CONFIG.milestones) {
                if (postLinkVolume >= m.volumeUsd && !claimed.includes(m.volumeUsd)) {
                    milestonesHit.push(m.volumeUsd);
                    referrerXp += m.bonusXp;
                    l1Usd += m.bonusUsd;
                }
            }
        }

        const batch = adminDb.batch();

        // Trader (invitee)
        const traderUpdate: Record<string, unknown> = {
            postLinkVolume,
            postLinkTrades,
            wallet: params.traderWallet,
        };
        if (refereeXpBonus > 0) {
            traderUpdate.points = FieldValue.increment(
                refereeXpBonus +
                    (firstQualify ? REFERRAL_CONFIG.firstTradeBonusRefereeXp : 0)
            );
        } else if (firstQualify) {
            traderUpdate.points = FieldValue.increment(
                REFERRAL_CONFIG.firstTradeBonusRefereeXp
            );
        }
        if (nowQualified) {
            traderUpdate.referralQualified = true;
            if (firstQualify) traderUpdate.referralQualifiedAt = new Date().toISOString();
        }
        if (refereeCashbackUsd > 0) {
            traderUpdate.referralCashbackEarned = FieldValue.increment(refereeCashbackUsd);
            traderUpdate.referralClaimableUsd = FieldValue.increment(refereeCashbackUsd);
        }
        if (firstQualify) traderUpdate.firstTradeBonusClaimed = true;
        if (milestonesHit.length) {
            traderUpdate.referralMilestonesClaimed = [
                ...new Set([...claimed, ...milestonesHit]),
            ];
        }
        batch.set(traderRef, traderUpdate, { merge: true });

        // L1
        if (l1Usd > 0 || referrerXp > 0 || firstQualify) {
            const l1Update: Record<string, unknown> = {
                wallet: l1,
                lastReferralEarning: new Date().toISOString(),
            };
            if (referrerXp > 0) l1Update.points = FieldValue.increment(referrerXp);
            if (l1Usd > 0) {
                l1Update.referralEarnings = FieldValue.increment(l1Usd);
                l1Update.referralClaimableUsd = FieldValue.increment(l1Usd);
            }
            if (vol > 0 && nowQualified) {
                l1Update.referralVolumeGenerated = FieldValue.increment(vol);
            }
            if (firstQualify) {
                l1Update.qualifiedReferralCount = FieldValue.increment(1);
            }
            batch.set(adminDb.collection("users").doc(l1), l1Update, { merge: true });
        }

        // L2
        if (l2 && l2Usd > 0) {
            batch.set(
                adminDb.collection("users").doc(l2),
                {
                    referralEarnings: FieldValue.increment(l2Usd),
                    referralClaimableUsd: FieldValue.increment(l2Usd),
                    referralL2Earnings: FieldValue.increment(l2Usd),
                    points: FieldValue.increment(Math.floor(vol * 0.05)),
                    wallet: l2,
                },
                { merge: true }
            );
        }

        batch.set(eventRef, {
            type: "trade",
            source: params.source,
            eventId: params.eventId,
            trader: params.traderWallet,
            referrer: l1,
            l2,
            feeUsd: fee,
            volumeUsd: vol,
            postLinkVolume,
            postLinkTrades,
            qualified: nowQualified,
            firstQualify,
            l1Usd,
            l2Usd,
            l1Share,
            l2Share,
            refereeCashbackUsd,
            referrerXp,
            refereeXpBonus:
                refereeXpBonus +
                (firstQualify ? REFERRAL_CONFIG.firstTradeBonusRefereeXp : 0),
            milestonesHit,
            minQualifyingVolumeUsd: REFERRAL_CONFIG.minQualifyingVolumeUsd,
            timestamp: FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString(),
        });

        await batch.commit();

        // Auto-payout when claimable crosses threshold (L1, L2, referee)
        const payoutTargets = new Set<string>();
        if (l1Usd > 0) payoutTargets.add(l1);
        if (l2 && l2Usd > 0) payoutTargets.add(l2);
        if (refereeCashbackUsd > 0) payoutTargets.add(params.traderWallet);

        const payoutResults: unknown[] = [];
        for (const w of payoutTargets) {
            try {
                const r = await tryAutoPayout(w);
                if (!r.skipped || r.success) payoutResults.push({ wallet: w, ...r });
            } catch (e) {
                console.error("[referral] auto-payout error", w, e);
            }
        }

        console.log(
            `[referral] ${params.eventId.slice(0, 10)}… qual=${nowQualified} L1=$${l1Usd.toFixed(4)} postVol=$${postLinkVolume.toFixed(0)}`
        );

        return {
            credited: true,
            qualified: nowQualified,
            l1Usd,
            l2Usd,
            refereeCashbackUsd,
            referrerXp,
            refereeXpBonus:
                refereeXpBonus +
                (firstQualify ? REFERRAL_CONFIG.firstTradeBonusRefereeXp : 0),
            milestonesHit,
            postLinkVolume,
            payout: payoutResults.length ? payoutResults : undefined,
        };
    } catch (e) {
        console.error("[referral] credit trade", e);
        return empty;
    }
}

export async function adminGetReferralStats(wallet: string) {
    const code = generateReferralCode(wallet);
    if (!adminDb) {
        return {
            referralCode: code,
            referralCount: 0,
            qualifiedReferralCount: 0,
            referralEarnings: 0,
            referralClaimableUsd: 0,
            referralPaidUsd: 0,
            referralVolumeGenerated: 0,
            referralCashbackEarned: 0,
            referredBy: null as string | null,
            affiliateTier: getAffiliateTier(0),
            config: publicConfig(),
            recentEvents: [] as unknown[],
            topReferrals: [] as unknown[],
        };
    }

    await adminInitializeReferralCode(wallet);

    const userSnap = await adminDb.collection("users").doc(wallet).get();
    const data = userSnap.data() || {};
    const qualifiedCount = Number(data.qualifiedReferralCount || 0);
    const tier = getAffiliateTier(qualifiedCount);

    let recentEvents: unknown[] = [];
    try {
        const ev = await adminDb
            .collection("referral_events")
            .where("referrer", "==", wallet)
            .orderBy("createdAt", "desc")
            .limit(15)
            .get();
        recentEvents = ev.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        try {
            const ev = await adminDb
                .collection("referral_events")
                .where("referrer", "==", wallet)
                .limit(30)
                .get();
            recentEvents = ev.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a: any, b: any) =>
                    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
                )
                .slice(0, 15);
        } catch {
            recentEvents = [];
        }
    }

    let topReferrals: unknown[] = [];
    try {
        const refs = await adminDb
            .collection("users")
            .where("referredBy", "==", wallet)
            .limit(30)
            .get();
        topReferrals = refs.docs
            .map((d) => {
                const u = d.data();
                const postVol = Number(u.postLinkVolume || 0);
                const need = REFERRAL_CONFIG.minQualifyingVolumeUsd;
                return {
                    wallet: d.id,
                    volume: u.volume || 0,
                    postLinkVolume: postVol,
                    postLinkTrades: u.postLinkTrades || 0,
                    qualified: !!u.referralQualified,
                    progressToQualify: Math.min(100, (postVol / need) * 100),
                    tradeCount: u.tradeCount || 0,
                    totalFeesPaid: u.totalFeesPaid || 0,
                    lastActive: u.lastActive || null,
                };
            })
            .sort((a, b) => b.postLinkVolume - a.postLinkVolume)
            .slice(0, 10);
    } catch {
        topReferrals = [];
    }

    // Own qualification if this wallet was referred
    const ownPostVol = Number(data.postLinkVolume || 0);
    const ownPostTrades = Number(data.postLinkTrades || 0);

    return {
        referralCode: data.referralCode || code,
        referralCount: data.referralCount || 0,
        qualifiedReferralCount: qualifiedCount,
        referralEarnings: data.referralEarnings || 0,
        referralClaimableUsd: data.referralClaimableUsd || 0,
        referralPaidUsd: data.referralPaidUsd || 0,
        referralVolumeGenerated: data.referralVolumeGenerated || 0,
        referralCashbackEarned: data.referralCashbackEarned || 0,
        referralL2Earnings: data.referralL2Earnings || 0,
        referredBy: data.referredBy || null,
        isReferred: !!data.referredBy,
        referralQualified: !!data.referralQualified,
        postLinkVolume: ownPostVol,
        postLinkTrades: ownPostTrades,
        qualifyProgress: Math.min(
            100,
            (ownPostVol / REFERRAL_CONFIG.minQualifyingVolumeUsd) * 100
        ),
        affiliateTier: tier,
        feeSharePercent: Math.round(tier.tier.feeShare * 100),
        config: publicConfig(),
        recentEvents,
        topReferrals,
    };
}

export async function adminGetTopReferrers(limitCount = 10) {
    if (!adminDb) return [];
    try {
        const snap = await adminDb
            .collection("users")
            .orderBy("referralEarnings", "desc")
            .limit(limitCount)
            .get();
        return snap.docs
            .filter((d) => (d.data().referralEarnings || 0) > 0)
            .map((d, i) => ({
                rank: i + 1,
                wallet: d.id,
                referralCount: d.data().referralCount || 0,
                qualifiedReferralCount: d.data().qualifiedReferralCount || 0,
                referralEarnings: d.data().referralEarnings || 0,
                referralPaidUsd: d.data().referralPaidUsd || 0,
                referralVolumeGenerated: d.data().referralVolumeGenerated || 0,
                tier: getAffiliateTier(
                    d.data().qualifiedReferralCount || d.data().referralCount || 0
                ).tier.label,
            }));
    } catch {
        const snap = await adminDb.collection("users").limit(200).get();
        return snap.docs
            .map((d) => ({
                wallet: d.id,
                referralCount: d.data().referralCount || 0,
                qualifiedReferralCount: d.data().qualifiedReferralCount || 0,
                referralEarnings: d.data().referralEarnings || 0,
                referralPaidUsd: d.data().referralPaidUsd || 0,
                referralVolumeGenerated: d.data().referralVolumeGenerated || 0,
            }))
            .filter((u) => u.referralEarnings > 0)
            .sort((a, b) => b.referralEarnings - a.referralEarnings)
            .slice(0, limitCount)
            .map((u, i) => ({
                rank: i + 1,
                ...u,
                tier: getAffiliateTier(u.qualifiedReferralCount || u.referralCount).tier
                    .label,
            }));
    }
}

function publicConfig() {
    return {
        headline: REFERRAL_CONFIG.headline,
        subhead: REFERRAL_CONFIG.subhead,
        minQualifyingVolumeUsd: REFERRAL_CONFIG.minQualifyingVolumeUsd,
        minQualifyingTrades: REFERRAL_CONFIG.minQualifyingTrades,
        baseL1FeeShare: REFERRAL_CONFIG.baseL1FeeShare,
        maxL1FeeShare:
            REFERRAL_CONFIG.affiliateTiers[REFERRAL_CONFIG.affiliateTiers.length - 1]
                .feeShare,
        l2FeeShare: REFERRAL_CONFIG.l2FeeShare,
        refereeCashbackShare: REFERRAL_CONFIG.refereeCashbackShare,
        refereeXpMultiplier: REFERRAL_CONFIG.refereeXpMultiplier,
        signupBonusReferrerXp: REFERRAL_CONFIG.signupBonusReferrerXp,
        signupBonusRefereeXp: REFERRAL_CONFIG.signupBonusRefereeXp,
        firstTradeBonusReferrerXp: REFERRAL_CONFIG.firstTradeBonusReferrerXp,
        firstTradeBonusRefereeXp: REFERRAL_CONFIG.firstTradeBonusRefereeXp,
        firstTradeBonusReferrerUsd: REFERRAL_CONFIG.firstTradeBonusReferrerUsd,
        milestones: REFERRAL_CONFIG.milestones,
        affiliateTiers: REFERRAL_CONFIG.affiliateTiers,
        minPayoutUsd: REFERRAL_CONFIG.minPayoutUsd,
        maxPayoutUsd: REFERRAL_CONFIG.maxPayoutUsd,
        payoutMint: "USDC",
    };
}
