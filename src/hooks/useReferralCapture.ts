"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSearchParams } from "next/navigation";

/**
 * Captures ?ref=CODE → localStorage → registers on wallet connect (Admin/Firestore).
 */
export function useReferralCapture() {
    const { publicKey, connected } = useWallet();
    const searchParams = useSearchParams();
    const registered = useRef(false);

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
        if (!connected || !publicKey || registered.current) return;

        const wallet = publicKey.toString();

        // Always ensure user has a referral code index in Firestore
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

        if (!storedCode) return;

        registered.current = true;

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
                    console.log(
                        `[referral] Linked! +${result.signupBonus?.refereeXp ?? 0} XP for you`
                    );
                    window.dispatchEvent(
                        new CustomEvent("shx-referral-joined", { detail: result })
                    );
                } else if (result.reason === "Already referred") {
                    try {
                        localStorage.removeItem("shx_referral_code");
                    } catch {
                        /* ignore */
                    }
                } else {
                    // allow retry on next connect
                    registered.current = false;
                    console.log("[referral] not registered:", result.reason);
                }
            })
            .catch(() => {
                registered.current = false;
            });
    }, [connected, publicKey]);
}
