import type { Metadata } from "next";
import { ShxCinematicAd } from "@/components/ad/ShxCinematicAd";

export const metadata: Metadata = {
    title: "SHX Ad | Cinematic",
    description:
        "Coded SHX Exchange cinematic — non-custodial Solana, Jupiter Ultra, USDC referrals.",
    robots: { index: false, follow: true },
};

export default function AdPage() {
    return <ShxCinematicAd standalone />;
}
