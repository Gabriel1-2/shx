"use client";

import { ReactNode } from "react";
import { Inbox, TrendingUp, Users, Wallet } from "lucide-react";

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-4">
                {icon || <Inbox size={32} className="text-muted-foreground" />}
            </div>
            <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
            <p className="text-xs text-muted-foreground max-w-[200px]">{description}</p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-4 px-4 py-2 bg-primary text-black rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

// Preset empty states
export function NoTransactionsState() {
    return (
        <EmptyState
            icon={<TrendingUp size={28} className="text-muted-foreground" />}
            title="No Swaps Yet"
            description="Your transaction history will appear here after your first swap"
        />
    );
}

export function NoReferralsState() {
    return (
        <EmptyState
            icon={<Users size={28} className="text-muted-foreground" />}
            title="No Referrals Yet"
            description="Share your referral link to earn 10% of their trading fees"
        />
    );
}

export function WalletDisconnectedState({ onConnect }: { onConnect: () => void }) {
    return (
        <EmptyState
            icon={<Wallet size={28} className="text-muted-foreground" />}
            title="Wallet Not Connected"
            description="Connect your wallet to view your stats and start trading"
            action={{
                label: "Connect Wallet",
                onClick: onConnect
            }}
        />
    );
}

// Loading skeleton for lists
export function ListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3 p-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-white/10" />
                    <div className="flex-1 space-y-2">
                        <div className="w-24 h-3 bg-white/10 rounded" />
                        <div className="w-16 h-2 bg-white/5 rounded" />
                    </div>
                    <div className="w-16 h-4 bg-white/10 rounded" />
                </div>
            ))}
        </div>
    );
}

// Stat card skeleton
export function StatSkeleton() {
    return (
        <div className="rounded-xl border border-white/5 bg-black/40 p-4 animate-pulse">
            <div className="w-20 h-2 bg-white/10 rounded mb-2" />
            <div className="w-16 h-6 bg-white/10 rounded" />
        </div>
    );
}
