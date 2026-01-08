"use client";

import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSearchParams } from "next/navigation";
import { registerReferral, initializeReferralCode } from "@/lib/referrals";

/**
 * Hook to capture referral codes from URL parameters
 * Usage: Add useReferralCapture() to your main layout or page
 * 
 * When a user visits with ?ref=CODE, it will:
 * 1. Store the code in localStorage
 * 2. When wallet connects, register the referral relationship
 */
export function useReferralCapture() {
    const { publicKey, connected } = useWallet();
    const searchParams = useSearchParams();

    // Capture referral code from URL on page load
    useEffect(() => {
        const refCode = searchParams.get("ref");
        if (refCode) {
            // Store in localStorage until wallet connects
            localStorage.setItem("shx_referral_code", refCode.toUpperCase());
            console.log("📣 Referral code captured:", refCode);
        }
    }, [searchParams]);

    // When wallet connects, register the referral
    useEffect(() => {
        if (connected && publicKey) {
            const storedCode = localStorage.getItem("shx_referral_code");

            if (storedCode) {
                // Register the referral relationship
                registerReferral(publicKey.toString(), storedCode)
                    .then((result) => {
                        if (result.success) {
                            console.log("✅ Referral registered successfully!");
                            // Clear the stored code so we don't re-register
                            localStorage.removeItem("shx_referral_code");
                        } else {
                            console.log("⚠️ Referral not registered:", result.reason);
                        }
                    });
            }

            // Always initialize the user's own referral code
            initializeReferralCode(publicKey.toString());
        }
    }, [connected, publicKey]);
}
