"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * A hidden global component that quietly syncs Limit and DCA trades
 * in the background using the user's stored JWT. This ensures fees
 * and volumes are pushed to the database even if the user never
 * visits the dashboard or places a new order.
 */
export function BackgroundSyncer() {
    const { publicKey } = useWallet();
    const hasRun = useRef(false);

    useEffect(() => {
        if (!publicKey) return;

        // Run sync loop every 60 seconds
        const syncInterval = setInterval(() => {
            const jwt = localStorage.getItem("shx_jupiter_jwt");
            if (!jwt) return; // Need vault auth to sync order history

            const wallet = publicKey.toString();

            // 1. Sync Limits
            fetch("/api/limit/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet, jwt })
            }).catch(e => console.error("[BackgroundSyncer] Limit sync failed", e));

            // 2. Sync DCAs
            fetch("/api/dca/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet, jwt })
            }).catch(e => console.error("[BackgroundSyncer] DCA sync failed", e));

        }, 60000);

        // Run immediately on mount (once)
        if (!hasRun.current) {
            hasRun.current = true;
            const jwt = localStorage.getItem("shx_jupiter_jwt");
            if (jwt) {
                const wallet = publicKey.toString();
                fetch("/api/limit/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ wallet, jwt })
                }).catch(() => {});
                fetch("/api/dca/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ wallet, jwt })
                }).catch(() => {});
            }
        }

        return () => clearInterval(syncInterval);
    }, [publicKey]);

    return null; // Hidden component
}
