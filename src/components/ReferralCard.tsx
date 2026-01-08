"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getReferralStats, initializeReferralCode } from "@/lib/referrals";
import { Users, Copy, Check, Gift } from "lucide-react";

export function ReferralCard() {
    const { publicKey, connected } = useWallet();
    const [stats, setStats] = useState({
        referralCode: "",
        referralCount: 0,
        referralEarnings: 0
    });
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (publicKey) {
            // Initialize code if needed and fetch stats
            initializeReferralCode(publicKey.toString()).then(() => {
                getReferralStats(publicKey.toString()).then(setStats);
            });
        }
    }, [publicKey]);

    const copyReferralLink = () => {
        const link = `${window.location.origin}?ref=${stats.referralCode}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!connected) {
        return (
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Users size={18} className="text-primary" />
                    <h4 className="text-sm font-bold text-white">Referral Program</h4>
                </div>
                <p className="text-xs text-muted-foreground">Connect wallet to access your referral link</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-primary" />
                <h4 className="text-sm font-bold text-white">Referral Program</h4>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg bg-black/30 p-3 border border-white/5">
                    <div className="text-[10px] text-muted-foreground mb-1">Referrals</div>
                    <div className="text-lg font-bold text-white">{stats.referralCount}</div>
                </div>
                <div className="rounded-lg bg-black/30 p-3 border border-white/5">
                    <div className="text-[10px] text-muted-foreground mb-1">Earnings</div>
                    <div className="text-lg font-bold text-green-400">${stats.referralEarnings.toFixed(2)}</div>
                </div>
            </div>

            {/* Referral Link */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-muted-foreground">Your Referral Link</span>
                    <span className="text-[10px] text-green-400 font-bold opacity-0 transition-opacity duration-300 data-[visible=true]:opacity-100" data-visible={copied}>
                        Copied!
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
                        <span className="text-xs text-muted-foreground truncate">shx.app/?ref=</span>
                        <span className="text-sm font-mono font-bold text-primary">{stats.referralCode || "..."}</span>
                    </div>
                    <button
                        onClick={copyReferralLink}
                        className="px-4 py-2 rounded-lg bg-primary text-black font-bold text-xs hover:bg-primary/90 transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        {copied ? (
                            <>
                                <Check size={14} />
                                <span>Copied</span>
                            </>
                        ) : (
                            <>
                                <Copy size={14} />
                                <span>Copy Link</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Reward Info */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                <Gift size={14} className="text-green-400 shrink-0" />
                <div className="flex flex-col">
                    <span className="text-[10px] text-green-400 font-bold">
                        Earn 10% of fees
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        + 20% volume bonus in XP!
                    </span>
                </div>
            </div>
        </div>
    );
}
