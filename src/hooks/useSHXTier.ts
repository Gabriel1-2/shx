"use client";

import { useMemo } from "react";
import { useTokenBalance, useTokenPrice } from "@/hooks/useTokenData";
import { getTierForBalance, type FeeTier } from "@/lib/feeTiers";
import { SHULEVITZ_MINT } from "@/lib/constants";

export interface SHXTierData {
    tier: FeeTier;
    nextTier: FeeTier | null;
    shxBalance: number;
    shxValueUSD: number;
    shxNeeded: number;
    progress: number;
    feeBps: number;
    feePercent: number;
    label: string;
    loading: boolean;
}

/**
 * Hook that reads the connected wallet's SHX balance and computes their fee tier.
 */
export function useSHXTier(): SHXTierData {
    const { balance: shxBalance, loading: balanceLoading } = useTokenBalance(SHULEVITZ_MINT, 9);
    const { price: shxPrice } = useTokenPrice(SHULEVITZ_MINT);

    const tierData = useMemo(() => {
        const result = getTierForBalance(shxBalance);
        return {
            tier: result.tier,
            nextTier: result.nextTier,
            shxBalance,
            shxValueUSD: shxBalance * shxPrice,
            shxNeeded: result.shxNeeded,
            progress: result.progress,
            feeBps: result.tier.feeBps,
            feePercent: result.tier.feePercent,
            label: result.tier.label,
            loading: balanceLoading,
        };
    }, [shxBalance, shxPrice, balanceLoading]);

    return tierData;
}
