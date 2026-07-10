"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * Quietly syncs Limit and DCA fills so volume/leaderboard stay current
 * even if the user never opens the Orders panel.
 */
export function BackgroundSyncer() {
    const { publicKey } = useWallet();
    const hasRun = useRef(false);

    useEffect(() => {
        if (!publicKey) return;

        const wallet = publicKey.toString();

        const sync = () => {
            let jwt: string | null = null;
            try {
                const storedWallet = localStorage.getItem("shx_jupiter_jwt_wallet");
                if (!storedWallet || storedWallet === wallet) {
                    jwt = localStorage.getItem("shx_jupiter_jwt");
                }
            } catch {
                /* ignore */
            }

            if (jwt) {
                fetch("/api/limit/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ wallet, jwt }),
                }).catch((e) => console.error("[BackgroundSyncer] Limit sync failed", e));
            }

            fetch("/api/dca/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet }),
            }).catch((e) => console.error("[BackgroundSyncer] DCA sync failed", e));
        };

        const syncInterval = setInterval(sync, 60_000);

        if (!hasRun.current) {
            hasRun.current = true;
            sync();
        }

        return () => clearInterval(syncInterval);
    }, [publicKey]);

    return null;
}
