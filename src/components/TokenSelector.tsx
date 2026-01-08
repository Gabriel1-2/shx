"use client";

import { useState, useEffect } from "react";
import { Search, X, Star } from "lucide-react";

interface Token {
    address: string;
    symbol: string;
    name: string;
    logoURI: string;
    decimals?: number;
}

interface TokenSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (token: Token) => void;
}

// Top tokens to show initially (NO Jupiter token as requested)
const POPULAR_TOKENS: Token[] = [
    { address: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png", decimals: 9 },
    { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin", logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png", decimals: 6 },
    { address: "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q", symbol: "SHULEVITZ", name: "Shulevitz", logoURI: "/shulevitz-logo.png", decimals: 6 },
    { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether USD", logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png", decimals: 6 },
    { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I", decimals: 5 },
    { address: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", symbol: "POPCAT", name: "Popcat", logoURI: "https://bafkreidvkvuzyslw5jh5z242lgzwzhbi2kxxnpkb2iis7yn4hjlb7kxfou.ipfs.nftstorage.link/", decimals: 9 },
    { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", name: "dogwifhat", logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link", decimals: 6 },
];

// Tokens to exclude from search results
const EXCLUDED_SYMBOLS = ["JUP", "JUPITER"];

export function TokenSelector({ isOpen, onClose, onSelect }: TokenSelectorProps) {
    const [search, setSearch] = useState("");
    const [tokens, setTokens] = useState<Token[]>(POPULAR_TOKENS);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const searchTokens = async () => {
            if (search.length < 2) {
                setTokens(POPULAR_TOKENS);
                return;
            }

            setLoading(true);
            try {
                const res = await fetch("https://token.jup.ag/strict");
                const allTokens: Token[] = await res.json();

                const filtered = allTokens
                    .filter(t =>
                        !EXCLUDED_SYMBOLS.includes(t.symbol.toUpperCase()) && // Exclude Jupiter
                        (t.symbol.toLowerCase().includes(search.toLowerCase()) ||
                            t.name.toLowerCase().includes(search.toLowerCase()) ||
                            t.address === search)
                    )
                    .slice(0, 20);

                setTokens(filtered);
            } catch (error) {
                console.error("Token search failed", error);
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(searchTokens, 300);
        return () => clearTimeout(timeout);
    }, [search, isOpen]);

    // Reset search when modal opens
    useEffect(() => {
        if (isOpen) setSearch("");
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#0A0A0A] border border-white/10 shadow-2xl flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Select Token</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                        <X className="text-muted-foreground" size={18} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name or paste address"
                            className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Popular Label */}
                {search.length < 2 && (
                    <div className="px-4 py-2 flex items-center gap-2">
                        <Star size={12} className="text-yellow-500" />
                        <span className="text-xs text-muted-foreground font-medium">Popular Tokens</span>
                    </div>
                )}

                {/* Token List */}
                <div className="flex-1 overflow-y-auto px-2 pb-4">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            <div className="animate-pulse">Searching tokens...</div>
                        </div>
                    ) : tokens.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No tokens found for "{search}"
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {tokens.map((token) => (
                                <button
                                    key={token.address}
                                    onClick={() => {
                                        onSelect(token);
                                        onClose();
                                    }}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-left group"
                                >
                                    <img
                                        src={token.logoURI}
                                        alt={token.symbol}
                                        className="w-9 h-9 rounded-full bg-white/5 object-cover"
                                        onError={(e) => {
                                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=1a1a1a&color=fff&size=36&bold=true`;
                                        }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white group-hover:text-primary transition-colors">{token.symbol}</div>
                                        <div className="text-xs text-muted-foreground truncate">{token.name}</div>
                                    </div>
                                    {token.address === "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q" && (
                                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">0% FEE</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-white/5 text-center">
                    <span className="text-[10px] text-muted-foreground">
                        Powered by Jupiter Token List
                    </span>
                </div>
            </div>
        </div>
    );
}
