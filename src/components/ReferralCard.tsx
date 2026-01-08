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

            {/* Referral Code */}
            <div className="mb-3">
                <div className="text-[10px] text-muted-foreground mb-1.5">Your Referral Code</div>
                <div className="flex items-center gap-2">
                    <code className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-primary">
                        {stats.referralCode || "Loading..."}
                    </code>
                    <button
                        onClick={copyReferralLink}
                        className="p-2 rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors"
                    >
                        {copied ? (
                            <Check size={16} className="text-green-400" />
                        ) : (
                            <Copy size={16} className="text-primary" />
                        )}
                    </button>
                </div>
            </div>

            {/* Reward Info */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                <Gift size={14} className="text-green-400" />
                <span className="text-[10px] text-green-400">
                    Earn 10% of fees from referred traders!
                </span>
            </div>
        </div>
    );
}
