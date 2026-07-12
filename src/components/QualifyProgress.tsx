"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Target, Gift, CheckCircle2 } from "lucide-react";
import Link from "next/link";

/**
 * For referred wallets: show progress toward $100 / 2-trade qualification.
 */
export function QualifyProgress() {
    const { publicKey, connected } = useWallet();
    const [data, setData] = useState<{
        isReferred: boolean;
        referralQualified: boolean;
        postLinkVolume: number;
        postLinkTrades: number;
        qualifyProgress: number;
        minVol: number;
        minTrades: number;
    } | null>(null);

    useEffect(() => {
        if (!connected || !publicKey) {
            setData(null);
            return;
        }
        fetch("/api/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "stats", wallet: publicKey.toString() }),
        })
            .then((r) => r.json())
            .then((d) => {
                if (!d.isReferred) {
                    setData(null);
                    return;
                }
                setData({
                    isReferred: true,
                    referralQualified: !!d.referralQualified,
                    postLinkVolume: d.postLinkVolume || 0,
                    postLinkTrades: d.postLinkTrades || 0,
                    qualifyProgress: d.qualifyProgress || 0,
                    minVol: d.config?.minQualifyingVolumeUsd || 100,
                    minTrades: d.config?.minQualifyingTrades || 2,
                });
            })
            .catch(() => setData(null));

        const onSwap = () => setTimeout(() => {
            // re-fetch after trade
            fetch("/api/referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "stats", wallet: publicKey.toString() }),
            })
                .then((r) => r.json())
                .then((d) => {
                    if (!d.isReferred) return;
                    setData({
                        isReferred: true,
                        referralQualified: !!d.referralQualified,
                        postLinkVolume: d.postLinkVolume || 0,
                        postLinkTrades: d.postLinkTrades || 0,
                        qualifyProgress: d.qualifyProgress || 0,
                        minVol: d.config?.minQualifyingVolumeUsd || 100,
                        minTrades: d.config?.minQualifyingTrades || 2,
                    });
                })
                .catch(() => {});
        }, 8000);

        window.addEventListener("shx-swap-success", onSwap);
        return () => window.removeEventListener("shx-swap-success", onSwap);
    }, [connected, publicKey]);

    if (!data?.isReferred) return null;

    if (data.referralQualified) {
        return (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-center gap-3">
                <CheckCircle2 className="text-green-400 shrink-0" size={18} />
                <div className="min-w-0">
                    <div className="text-xs font-black text-green-400">Referral unlocked</div>
                    <p className="text-[11px] text-muted-foreground">
                        You earn 1.25× XP + 5% fee cashback. Your inviter earns fee share on your trades.
                    </p>
                </div>
                <Link href="/referrals" className="text-[10px] font-bold text-primary shrink-0">
                    Invite others →
                </Link>
            </div>
        );
    }

    const volLeft = Math.max(0, data.minVol - data.postLinkVolume);
    const tradesLeft = Math.max(0, data.minTrades - data.postLinkTrades);

    return (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-4 py-3">
            <div className="flex items-start gap-3">
                <Target className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Gift size={12} className="text-amber-400" />
                        <span className="text-xs font-black text-amber-300">
                            Unlock invitee rewards
                        </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">
                        Trade{" "}
                        <span className="text-white font-bold">${volLeft.toFixed(0)}</span> more
                        {tradesLeft > 0 && (
                            <>
                                {" "}
                                and complete{" "}
                                <span className="text-white font-bold">{tradesLeft}</span> more
                                trade{tradesLeft === 1 ? "" : "s"}
                            </>
                        )}{" "}
                        to unlock 1.25× XP + fee cashback.
                    </p>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-400 to-green-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, data.qualifyProgress)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                        <span>
                            ${data.postLinkVolume.toFixed(0)} / ${data.minVol}
                        </span>
                        <span>
                            {data.postLinkTrades} / {data.minTrades} trades
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
