"use client";

import { useEffect } from "react";
import { useToast } from "@/components/Toast";

/** Listens for successful tracked swaps and shows elite toasts. */
export function TradeToastListener() {
    const { showToast } = useToast();

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            const vol = Number(detail.volumeUSD || 0);
            const pts = Number(detail.points || 0);
            showToast({
                type: "success",
                title: detail.isNewTrader
                    ? "First SHX trade recorded"
                    : "Trade recorded",
                message: `$${vol.toFixed(2)} volume · +${pts} XP`,
                txId: detail.txid,
            });
        };
        window.addEventListener("shx-trade-toast", handler);
        return () => window.removeEventListener("shx-trade-toast", handler);
    }, [showToast]);

    return null;
}
