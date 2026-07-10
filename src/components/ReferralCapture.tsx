"use client";

import { useReferralCapture } from "@/hooks/useReferralCapture";

/** Mount once in the root layout to capture ?ref= and register on wallet connect. */
export function ReferralCapture() {
    useReferralCapture();
    return null;
}
