/**
 * Server-side live platform stats (Admin SDK).
 * Maintains a fast counter doc + full recompute fallback.
 */
import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export interface LivePlatformStats {
    /** Unique wallets that have completed ≥1 trade on SHX */
    tradersAllTime: number;
    /** Unique wallets with volume today (UTC) */
    tradersToday: number;
    totalVolume: number;
    totalTrades: number;
    totalFees: number;
    dailyVolume: number;
    dailyTrades: number;
    dailyFees: number;
    referralPaidUsd: number;
    referralClaimableUsd: number;
    qualifiedReferrals: number;
    recentTraders: Array<{
        wallet: string;
        volume: number;
        tradeCount: number;
        lastActive: string | null;
    }>;
    updatedAt: string;
    source: "cache" | "recompute";
}

function dayIdUTC(d = new Date()): string {
    return d.toISOString().split("T")[0];
}

/**
 * Bump counters after a successful tracked trade (call from analytics).
 */
export async function bumpLiveStatsOnTrade(params: {
    wallet: string;
    volumeUsd: number;
    feeUsd: number;
    isNewTrader: boolean;
}): Promise<void> {
    if (!adminDb) return;

    const day = dayIdUTC();
    const statsRef = adminDb.collection("system").doc("platform_stats");
    const dayRef = adminDb.collection("system").doc(`daily_${day}`);
    const traderDayRef = adminDb
        .collection("system")
        .doc(`daily_${day}`)
        .collection("traders")
        .doc(params.wallet);

    try {
        await adminDb.runTransaction(async (t) => {
            const daySnap = await t.get(dayRef);
            const traderDaySnap = await t.get(traderDayRef);
            const isNewToday = !traderDaySnap.exists;

            t.set(
                statsRef,
                {
                    totalVolume: FieldValue.increment(params.volumeUsd),
                    totalTrades: FieldValue.increment(1),
                    totalFees: FieldValue.increment(params.feeUsd),
                    ...(params.isNewTrader
                        ? { tradersAllTime: FieldValue.increment(1) }
                        : {}),
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );

            t.set(
                dayRef,
                {
                    date: day,
                    volume: FieldValue.increment(params.volumeUsd),
                    trades: FieldValue.increment(1),
                    fees: FieldValue.increment(params.feeUsd),
                    ...(isNewToday ? { traders: FieldValue.increment(1) } : {}),
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );

            t.set(
                traderDayRef,
                {
                    wallet: params.wallet,
                    volume: FieldValue.increment(params.volumeUsd),
                    trades: FieldValue.increment(1),
                    lastTradeAt: new Date().toISOString(),
                },
                { merge: true }
            );
        });
    } catch (e) {
        console.error("[liveStats] bump failed", e);
    }
}

/**
 * Full recompute from users collection (source of truth).
 * Also refreshes the cache doc.
 */
export async function recomputeLiveStats(): Promise<LivePlatformStats> {
    const empty: LivePlatformStats = {
        tradersAllTime: 0,
        tradersToday: 0,
        totalVolume: 0,
        totalTrades: 0,
        totalFees: 0,
        dailyVolume: 0,
        dailyTrades: 0,
        dailyFees: 0,
        referralPaidUsd: 0,
        referralClaimableUsd: 0,
        qualifiedReferrals: 0,
        recentTraders: [],
        updatedAt: new Date().toISOString(),
        source: "recompute",
    };

    if (!adminDb) return empty;

    const day = dayIdUTC();
    const usersSnap = await adminDb.collection("users").get();

    let tradersAllTime = 0;
    let tradersToday = 0;
    let totalVolume = 0;
    let totalTrades = 0;
    let totalFees = 0;
    let dailyVolume = 0;
    let dailyTrades = 0;
    let dailyFees = 0;
    let referralPaidUsd = 0;
    let referralClaimableUsd = 0;
    let qualifiedReferrals = 0;

    const traderList: LivePlatformStats["recentTraders"] = [];

    usersSnap.forEach((doc) => {
        const d = doc.data();
        const vol = Number(d.volume || 0);
        const trades = Number(d.tradeCount || 0);
        const fees = Number(d.totalFeesPaid || 0);

        totalVolume += vol;
        totalTrades += trades;
        totalFees += fees;
        referralPaidUsd += Number(d.referralPaidUsd || 0);
        referralClaimableUsd += Number(d.referralClaimableUsd || 0);
        if (d.referralQualified) qualifiedReferrals += 1;

        if (vol > 0 || trades > 0) {
            tradersAllTime += 1;
            traderList.push({
                wallet: doc.id,
                volume: vol,
                tradeCount: trades,
                lastActive: d.lastActive || null,
            });
        }

        if (d.dayStart === day) {
            const dVol = Number(d.dailyVolume || 0);
            const dTrades = Number(d.dailyTradeCount || 0);
            const dFees = Number(d.dailyFeesPaid || 0);
            if (dVol > 0 || dTrades > 0) {
                tradersToday += 1;
                dailyVolume += dVol;
                dailyTrades += dTrades;
                dailyFees += dFees;
            }
        }
    });

    // Recent = highest volume traders (public leaderboard-style sample)
    const recentTraders = traderList
        .sort((a, b) => {
            const ta = a.lastActive ? new Date(a.lastActive).getTime() : 0;
            const tb = b.lastActive ? new Date(b.lastActive).getTime() : 0;
            if (tb !== ta) return tb - ta;
            return b.volume - a.volume;
        })
        .slice(0, 12)
        .map((t) => ({
            ...t,
            // Mask middle of wallet for public display privacy
            wallet: `${t.wallet.slice(0, 4)}…${t.wallet.slice(-4)}`,
        }));

    const result: LivePlatformStats = {
        tradersAllTime,
        tradersToday,
        totalVolume,
        totalTrades,
        totalFees,
        dailyVolume,
        dailyTrades,
        dailyFees,
        referralPaidUsd,
        referralClaimableUsd,
        qualifiedReferrals,
        recentTraders,
        updatedAt: new Date().toISOString(),
        source: "recompute",
    };

    // Cache for fast polls
    try {
        await adminDb.collection("system").doc("platform_stats").set(
            {
                tradersAllTime,
                totalVolume,
                totalTrades,
                totalFees,
                referralPaidUsd,
                referralClaimableUsd,
                qualifiedReferrals,
                updatedAt: result.updatedAt,
                lastRecomputeAt: result.updatedAt,
            },
            { merge: true }
        );
        await adminDb.collection("system").doc(`daily_${day}`).set(
            {
                date: day,
                traders: tradersToday,
                volume: dailyVolume,
                trades: dailyTrades,
                fees: dailyFees,
                updatedAt: result.updatedAt,
            },
            { merge: true }
        );
    } catch (e) {
        console.warn("[liveStats] cache write failed", e);
    }

    return result;
}

/**
 * Fast path: read cache + today's daily doc; recompute if cache cold/stale.
 */
export async function getLiveStats(opts?: {
    forceRecompute?: boolean;
}): Promise<LivePlatformStats> {
    if (!adminDb) {
        return {
            tradersAllTime: 0,
            tradersToday: 0,
            totalVolume: 0,
            totalTrades: 0,
            totalFees: 0,
            dailyVolume: 0,
            dailyTrades: 0,
            dailyFees: 0,
            referralPaidUsd: 0,
            referralClaimableUsd: 0,
            qualifiedReferrals: 0,
            recentTraders: [],
            updatedAt: new Date().toISOString(),
            source: "cache",
        };
    }

    if (opts?.forceRecompute) {
        return recomputeLiveStats();
    }

    const day = dayIdUTC();
    try {
        const [statsSnap, daySnap] = await Promise.all([
            adminDb.collection("system").doc("platform_stats").get(),
            adminDb.collection("system").doc(`daily_${day}`).get(),
        ]);

        // Cold cache → full recompute
        if (!statsSnap.exists) {
            return recomputeLiveStats();
        }

        const s = statsSnap.data() || {};
        const d = daySnap.data() || {};
        const last = s.lastRecomputeAt || s.updatedAt;
        const ageMs = last ? Date.now() - new Date(last).getTime() : Infinity;

        // Recompute every 5 minutes for accuracy on trader counts
        if (ageMs > 5 * 60 * 1000) {
            return recomputeLiveStats();
        }

        // Recent traders still need a light user query (or empty)
        let recentTraders: LivePlatformStats["recentTraders"] = [];
        try {
            const recent = await adminDb
                .collection("users")
                .orderBy("lastActive", "desc")
                .limit(20)
                .get();
            recentTraders = recent.docs
                .filter((doc) => {
                    const x = doc.data();
                    return (x.volume || 0) > 0 || (x.tradeCount || 0) > 0;
                })
                .slice(0, 12)
                .map((doc) => {
                    const x = doc.data();
                    return {
                        wallet: `${doc.id.slice(0, 4)}…${doc.id.slice(-4)}`,
                        volume: x.volume || 0,
                        tradeCount: x.tradeCount || 0,
                        lastActive: x.lastActive || null,
                    };
                });
        } catch {
            recentTraders = [];
        }

        return {
            tradersAllTime: Number(s.tradersAllTime || 0),
            tradersToday: Number(d.traders || 0),
            totalVolume: Number(s.totalVolume || 0),
            totalTrades: Number(s.totalTrades || 0),
            totalFees: Number(s.totalFees || 0),
            dailyVolume: Number(d.volume || 0),
            dailyTrades: Number(d.trades || 0),
            dailyFees: Number(d.fees || 0),
            referralPaidUsd: Number(s.referralPaidUsd || 0),
            referralClaimableUsd: Number(s.referralClaimableUsd || 0),
            qualifiedReferrals: Number(s.qualifiedReferrals || 0),
            recentTraders,
            updatedAt: s.updatedAt || new Date().toISOString(),
            source: "cache",
        };
    } catch (e) {
        console.error("[liveStats] get failed, recomputing", e);
        return recomputeLiveStats();
    }
}
