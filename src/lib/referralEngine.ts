/**
 * Server-side referral engine — all Firestore writes via Admin SDK.
 */
import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import {
    REFERRAL_CONFIG,
    getAffiliateTier,
    getL1FeeShare,
} from "./referralConfig";

export function generateReferralCode(wallet: string): string {
    return `SHX-${wallet.slice(0, 4)}${wallet.slice(-4)}`.toUpperCase();
}

function normalizeCode(code: string): string {
    return code.trim().toUpperCase().replace(/^REF[-_]?/, "SHX-");
}

/** Ensure user has a code + code→wallet index doc */
export async function adminInitializeReferralCode(wallet: string): Promise<string> {
    const code = generateReferralCode(wallet);
    if (!adminDb) return code;

    try {
        const userRef = adminDb.collection("users").doc(wallet);
        const snap = await userRef.get();
        const existing = snap.exists ? (snap.data()?.referralCode as string | undefined) : undefined;
        const finalCode = existing || code;

        if (!existing) {
            await userRef.set(
                {
                    wallet,
                    referralCode: finalCode,
                    referralCount: 0,
                    referralEarnings: 0,
                    referralClaimableUsd: 0,
                    referralVolumeGenerated: 0,
                    referredVolume: 0,
                },
                { merge: true }
            );
        }

        // Index for O(1) code lookup
        await adminDb.collection("referral_codes").doc(finalCode).set(
            {
                code: finalCode,
                wallet,
                updatedAt: new Date().toISOString(),
            },
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

    // Prefer index collection
    const idx = await adminDb.collection("referral_codes").doc(normalized).get();
    if (idx.exists && idx.data()?.wallet) {
        return idx.data()!.wallet as string;
    }

    // Fallback: scan users by referralCode
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
            return { success: false, reason: "Already referred", referrer: existing.data()!.referredBy };
        }

        // Capture L2 (referrer of referrer)
        const referrerDoc = await adminDb.collection("users").doc(referrerWallet).get();
        const l2 = (referrerDoc.data()?.referredBy as string | undefined) || null;

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

        // Event log
        await adminDb.collection("referral_events").add({
            type: "signup",
            referrer: referrerWallet,
            referee: newUserWallet,
            l2: l2,
            referrerXp: signupReferrerXp,
            refereeXp: signupRefereeXp,
            code: normalizeCode(referralCode),
            timestamp: FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString(),
        });

        // Ensure both have codes
        await adminInitializeReferralCode(newUserWallet);
        await adminInitializeReferralCode(referrerWallet);

        console.log(
            `[referral] Linked ${newUserWallet.slice(0, 8)} → ${referrerWallet.slice(0, 8)} (+${signupReferrerXp}/${signupRefereeXp} XP)`
        );

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
    l1Usd: number;
    l2Usd: number;
    refereeCashbackUsd: number;
    referrerXp: number;
    refereeXpBonus: number;
    milestonesHit: number[];
}

/**
 * Credit referral rewards for a completed trade.
 * Idempotent via referral_events doc id = `trade-{eventId}`.
 */
export async function adminCreditTradeReferral(params: {
    eventId: string; // txid or order fill id
    traderWallet: string;
    feeUsd: number;
    volumeUsd: number;
    source: "swap" | "limit" | "dca" | "agent";
}): Promise<TradeReferralResult> {
    const empty: TradeReferralResult = {
        credited: false,
        l1Usd: 0,
        l2Usd: 0,
        refereeCashbackUsd: 0,
        referrerXp: 0,
        refereeXpBonus: 0,
        milestonesHit: [],
    };

    if (!adminDb || (params.feeUsd <= 0 && params.volumeUsd <= 0)) return empty;

    const eventRef = adminDb.collection("referral_events").doc(`trade-${params.eventId}`);
    try {
        const existing = await eventRef.get();
        if (existing.exists) return empty;

        const traderRef = adminDb.collection("users").doc(params.traderWallet);
        const traderSnap = await traderRef.get();
        const trader = traderSnap.data() || {};
        const l1 = trader.referredBy as string | undefined;
        if (!l1) return empty;

        const l2 = (trader.referredByL2 as string | undefined) || null;

        const l1User = (await adminDb.collection("users").doc(l1).get()).data() || {};
        const l1Count = (l1User.referralCount as number) || 0;
        let l1Share = getL1FeeShare(l1Count);
        let l2Share = l2 ? REFERRAL_CONFIG.l2FeeShare : 0;

        // Cap total share
        if (l1Share + l2Share > REFERRAL_CONFIG.maxTotalFeeShare) {
            l2Share = Math.max(0, REFERRAL_CONFIG.maxTotalFeeShare - l1Share);
        }

        const fee = Math.max(0, params.feeUsd);
        const vol = Math.max(0, params.volumeUsd);

        let l1Usd = fee * l1Share;
        let l2Usd = l2 ? fee * l2Share : 0;
        let refereeCashbackUsd = fee * REFERRAL_CONFIG.refereeCashbackShare;

        // XP: base volume XP already awarded elsewhere; bonus for referee + referrer kick
        const baseXp = Math.max(1, Math.floor(vol));
        const refereeXpBonus = Math.floor(
            baseXp * (REFERRAL_CONFIG.refereeXpMultiplier - 1)
        );
        // Referrer earns XP equal to 50% of referred volume (growth flywheel for leaderboard)
        let referrerXp = Math.floor(vol * 0.5);

        // First trade bonus
        let firstTrade = false;
        if (
            !trader.firstTradeBonusClaimed &&
            vol >= REFERRAL_CONFIG.firstTradeMinVolumeUsd
        ) {
            firstTrade = true;
            referrerXp += REFERRAL_CONFIG.firstTradeBonusReferrerXp;
            l1Usd += REFERRAL_CONFIG.firstTradeBonusReferrerUsd;
        }

        // Milestones on this referee's cumulative referred volume for L1
        const prevVol = (trader.volume as number) || 0;
        // volume may already include this trade if called after volume write — use pre/post carefully
        // We pass volume of THIS trade; cumulative after trade ≈ trader.volume (if already updated) or +vol
        const cumulative = Math.max(prevVol, vol); // if track updated first, prevVol includes trade
        const milestonesHit: number[] = [];
        const claimed: number[] = (trader.referralMilestonesClaimed as number[]) || [];

        for (const m of REFERRAL_CONFIG.milestones) {
            if (cumulative >= m.volumeUsd && !claimed.includes(m.volumeUsd)) {
                milestonesHit.push(m.volumeUsd);
                referrerXp += m.bonusXp;
                l1Usd += m.bonusUsd;
            }
        }

        const batch = adminDb.batch();

        // L1 referrer
        batch.set(
            adminDb.collection("users").doc(l1),
            {
                referralEarnings: FieldValue.increment(l1Usd),
                referralClaimableUsd: FieldValue.increment(l1Usd),
                referralVolumeGenerated: FieldValue.increment(vol),
                points: FieldValue.increment(referrerXp),
                lastReferralEarning: new Date().toISOString(),
                wallet: l1,
            },
            { merge: true }
        );

        // L2
        if (l2 && l2Usd > 0) {
            batch.set(
                adminDb.collection("users").doc(l2),
                {
                    referralEarnings: FieldValue.increment(l2Usd),
                    referralClaimableUsd: FieldValue.increment(l2Usd),
                    referralL2Earnings: FieldValue.increment(l2Usd),
                    points: FieldValue.increment(Math.floor(vol * 0.1)),
                    wallet: l2,
                },
                { merge: true }
            );
        }

        // Referee updates (cashback + XP bonus + first-trade flags)
        const refereeXpTotal =
            refereeXpBonus + (firstTrade ? REFERRAL_CONFIG.firstTradeBonusRefereeXp : 0);
        const traderUpdate: Record<string, unknown> = {
            referralCashbackEarned: FieldValue.increment(refereeCashbackUsd),
            referralClaimableUsd: FieldValue.increment(refereeCashbackUsd),
            wallet: params.traderWallet,
        };
        if (refereeXpTotal > 0) {
            traderUpdate.points = FieldValue.increment(refereeXpTotal);
        }
        if (firstTrade) {
            traderUpdate.firstTradeBonusClaimed = true;
        }
        if (milestonesHit.length) {
            traderUpdate.referralMilestonesClaimed = [
                ...new Set([...claimed, ...milestonesHit]),
            ];
        }
        batch.set(traderRef, traderUpdate, { merge: true });

        batch.set(eventRef, {
            type: "trade",
            source: params.source,
            eventId: params.eventId,
            trader: params.traderWallet,
            referrer: l1,
            l2: l2,
            feeUsd: fee,
            volumeUsd: vol,
            l1Usd,
            l2Usd,
            l1Share,
            l2Share,
            refereeCashbackUsd,
            referrerXp,
            refereeXpBonus: refereeXpBonus + (firstTrade ? REFERRAL_CONFIG.firstTradeBonusRefereeXp : 0),
            firstTrade,
            milestonesHit,
            timestamp: FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString(),
        });

        await batch.commit();

        console.log(
            `[referral] trade ${params.eventId.slice(0, 10)}… L1=$${l1Usd.toFixed(4)} L2=$${l2Usd.toFixed(4)} cashback=$${refereeCashbackUsd.toFixed(4)}`
        );

        return {
            credited: true,
            l1Usd,
            l2Usd,
            refereeCashbackUsd,
            referrerXp,
            refereeXpBonus: refereeXpBonus + (firstTrade ? REFERRAL_CONFIG.firstTradeBonusRefereeXp : 0),
            milestonesHit,
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
            referralEarnings: 0,
            referralClaimableUsd: 0,
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
    const count = data.referralCount || 0;
    const tier = getAffiliateTier(count);

    // Recent events involving this wallet as referrer
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
        // Index may be missing — fall back unordered
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

    // Sample of referred users
    let topReferrals: unknown[] = [];
    try {
        const refs = await adminDb
            .collection("users")
            .where("referredBy", "==", wallet)
            .limit(20)
            .get();
        topReferrals = refs.docs
            .map((d) => {
                const u = d.data();
                return {
                    wallet: d.id,
                    volume: u.volume || 0,
                    tradeCount: u.tradeCount || 0,
                    totalFeesPaid: u.totalFeesPaid || 0,
                    lastActive: u.lastActive || null,
                };
            })
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 10);
    } catch {
        topReferrals = [];
    }

    return {
        referralCode: data.referralCode || code,
        referralCount: count,
        referralEarnings: data.referralEarnings || 0,
        referralClaimableUsd: data.referralClaimableUsd || data.referralEarnings || 0,
        referralVolumeGenerated: data.referralVolumeGenerated || 0,
        referralCashbackEarned: data.referralCashbackEarned || 0,
        referralL2Earnings: data.referralL2Earnings || 0,
        referredBy: data.referredBy || null,
        isReferred: !!data.referredBy,
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
                referralEarnings: d.data().referralEarnings || 0,
                referralVolumeGenerated: d.data().referralVolumeGenerated || 0,
                tier: getAffiliateTier(d.data().referralCount || 0).tier.label,
            }));
    } catch {
        // Fallback without index
        const snap = await adminDb.collection("users").limit(200).get();
        return snap.docs
            .map((d) => ({
                wallet: d.id,
                referralCount: d.data().referralCount || 0,
                referralEarnings: d.data().referralEarnings || 0,
                referralVolumeGenerated: d.data().referralVolumeGenerated || 0,
            }))
            .filter((u) => u.referralEarnings > 0)
            .sort((a, b) => b.referralEarnings - a.referralEarnings)
            .slice(0, limitCount)
            .map((u, i) => ({
                rank: i + 1,
                ...u,
                tier: getAffiliateTier(u.referralCount).tier.label,
            }));
    }
}

function publicConfig() {
    return {
        headline: REFERRAL_CONFIG.headline,
        subhead: REFERRAL_CONFIG.subhead,
        baseL1FeeShare: REFERRAL_CONFIG.baseL1FeeShare,
        maxL1FeeShare: REFERRAL_CONFIG.affiliateTiers[REFERRAL_CONFIG.affiliateTiers.length - 1].feeShare,
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
    };
}
