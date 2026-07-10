"use client";

import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSearchParams } from "next/navigation";

/**
 * Captures ?ref=CODE and registers referral via Admin-backed API
 * (client Firestore writes are denied by rules).
 */
export function useReferralCapture() {
    const { publicKey, connected } = useWallet();
    const searchParams = useSearchParams();

    useEffect(() => {
        const refCode = searchParams.get("ref");
        if (refCode) {
            try {
                localStorage.setItem("shx_referral_code", refCode.toUpperCase());
            } catch {
                /* ignore */
            }
        }
    }, [searchParams]);

    useEffect(() => {
        if (!connected || !publicKey) return;

        const wallet = publicKey.toString();

        // Always ensure user has a referral code (server write)
        fetch("/api/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "init", wallet }),
        }).catch(() => {});

        let storedCode: string | null = null;
        try {
            storedCode = localStorage.getItem("shx_referral_code");
        } catch {
            /* ignore */
        }

        if (storedCode) {
            fetch("/api/referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "register",
                    wallet,
                    referralCode: storedCode,
                }),
            })
                .then((r) => r.json())
                .then((result) => {
                    if (result.success) {
                        try {
                            localStorage.removeItem("shx_referral_code");
                        } catch {
                            /* ignore */
                        }
                    }
                })
                .catch(() => {});
        }
    }, [connected, publicKey]);
}
