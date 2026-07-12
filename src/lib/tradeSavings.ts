/**
 * Client-side fee savings accounting for post-trade receipts.
 * Base platform fee is 0.65%; tier holders + SHX buys save vs base.
 */
import { FEE_TIERS } from "./feeTiers";

const STORAGE_KEY = "shx_lifetime_savings_v1";
const CEX_COMPARE_BPS = 100; // ~1% illustrative CEX-style friction

export interface SavingsSnapshot {
    lifetimeSavedUsd: number;
    tradeCount: number;
    lastSavedUsd: number;
    lastVolumeUsd: number;
    lastFeeBps: number;
    lastTierLabel: string;
    updatedAt: string;
}

export function baseFeeBps(): number {
    return FEE_TIERS[0].feeBps;
}

/** Platform fee USD at given bps */
export function feeUsdAtBps(volumeUsd: number, bps: number): number {
    return (volumeUsd * bps) / 10_000;
}

/**
 * Savings vs SHX base tier (0.65%).
 * SHX buys (0 bps) save the full base fee.
 */
export function savingsVsBase(volumeUsd: number, effectiveFeeBps: number): number {
    const base = feeUsdAtBps(volumeUsd, baseFeeBps());
    const paid = feeUsdAtBps(volumeUsd, Math.max(0, effectiveFeeBps));
    return Math.max(0, base - paid);
}

/** Illustrative savings vs ~1% CEX-style cost */
export function savingsVsCex(volumeUsd: number, effectiveFeeBps: number): number {
    const cex = feeUsdAtBps(volumeUsd, CEX_COMPARE_BPS);
    const paid = feeUsdAtBps(volumeUsd, Math.max(0, effectiveFeeBps));
    return Math.max(0, cex - paid);
}

export function loadLifetimeSavings(): SavingsSnapshot {
    if (typeof window === "undefined") {
        return emptySnapshot();
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptySnapshot();
        return { ...emptySnapshot(), ...JSON.parse(raw) };
    } catch {
        return emptySnapshot();
    }
}

function emptySnapshot(): SavingsSnapshot {
    return {
        lifetimeSavedUsd: 0,
        tradeCount: 0,
        lastSavedUsd: 0,
        lastVolumeUsd: 0,
        lastFeeBps: baseFeeBps(),
        lastTierLabel: "Base",
        updatedAt: new Date().toISOString(),
    };
}

export function recordTradeSavings(params: {
    volumeUsd: number;
    effectiveFeeBps: number;
    tierLabel: string;
}): SavingsSnapshot {
    const saved = savingsVsBase(params.volumeUsd, params.effectiveFeeBps);
    const prev = loadLifetimeSavings();
    const next: SavingsSnapshot = {
        lifetimeSavedUsd: prev.lifetimeSavedUsd + saved,
        tradeCount: prev.tradeCount + 1,
        lastSavedUsd: saved,
        lastVolumeUsd: params.volumeUsd,
        lastFeeBps: params.effectiveFeeBps,
        lastTierLabel: params.tierLabel,
        updatedAt: new Date().toISOString(),
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* ignore */
    }
    return next;
}
