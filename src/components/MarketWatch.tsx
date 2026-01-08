"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getFavoriteTokens, addFavoriteToken, removeFavoriteToken, DEFAULT_TOKENS } from "@/lib/favorites";
import { TrendingUp, TrendingDown, Star, Plus, X, Loader2, Search, Zap } from "lucide-react";

interface TokenData {
    address: string;
    symbol: string;
    name: string;
    price: number;
    prevPrice: number;
    change24h: number;
    volume24h: number;
    logoURI?: string;
    isFavorite: boolean;
    priceDirection: "up" | "down" | "neutral";
}

interface SearchResult {
    address: string;
    symbol: string;
    name: string;
    logoURI?: string;
}

const TOKEN_INFO: Record<string, { symbol: string; name: string; logoURI: string }> = {
    "So11111111111111111111111111111111111111112": {
        symbol: "SOL",
        name: "Solana",
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
    },
    "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q": {
        symbol: "SHX",
        name: "Shulevitz",
        logoURI: "/shulevitz-logo.png"
    },
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {
        symbol: "USDC",
        name: "USD Coin",
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
    },
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": {
        symbol: "BONK",
        name: "Bonk",
        logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I"
    },
    "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": {
        symbol: "WIF",
        name: "dogwifhat",
        logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betiez6dqmjpbhzyjfniq.ipfs.nftstorage.link/"
    },
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": {
        symbol: "JUP",
        name: "Jupiter",
        logoURI: "https://static.jup.ag/jup/icon.png"
    },
};

const SHULEVITZ_MINT = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";
const UPDATE_INTERVAL = 5000; // 5 seconds for "real-time" feel

export function MarketWatch() {
    const { publicKey, connected } = useWallet();
    const [tokens, setTokens] = useState<TokenData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [addingToken, setAddingToken] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const previousPrices = useRef<Record<string, number>>({});

    const searchTokens = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (data.pairs && data.pairs.length > 0) {
                const seen = new Set<string>();
                const results: SearchResult[] = [];

                for (const pair of data.pairs) {
                    if (pair.chainId !== "solana") continue;
                    const token = pair.baseToken;
                    if (!seen.has(token.address)) {
                        seen.add(token.address);
                        results.push({
                            address: token.address,
                            symbol: token.symbol,
                            name: token.name || token.symbol,
                            logoURI: pair.info?.imageUrl
                        });
                    }
                    if (results.length >= 5) break;
                }
                setSearchResults(results);
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery) searchTokens(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, searchTokens]);

    const fetchPricesForTokens = useCallback(async (addresses: string[]) => {
        const results: TokenData[] = [];

        for (const address of addresses) {
            try {
                const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
                const data = await res.json();

                const knownInfo = TOKEN_INFO[address];

                if (data.pairs && data.pairs.length > 0) {
                    const pair = data.pairs[0];
                    const symbol = knownInfo?.symbol || pair.baseToken?.symbol || address.slice(0, 4);
                    const name = knownInfo?.name || pair.baseToken?.name || "Unknown";
                    const logoURI = knownInfo?.logoURI || pair.info?.imageUrl;

                    const currentPrice = parseFloat(pair.priceUsd) || 0;
                    const prevPrice = previousPrices.current[address] || currentPrice;

                    let priceDirection: "up" | "down" | "neutral" = "neutral";
                    if (currentPrice > prevPrice) priceDirection = "up";
                    else if (currentPrice < prevPrice) priceDirection = "down";

                    previousPrices.current[address] = currentPrice;

                    results.push({
                        address,
                        symbol,
                        name,
                        price: currentPrice,
                        prevPrice,
                        change24h: pair.priceChange?.h24 || 0,
                        volume24h: pair.volume?.h24 || 0,
                        logoURI,
                        isFavorite: !DEFAULT_TOKENS.includes(address) && address !== SHULEVITZ_MINT,
                        priceDirection
                    });
                } else if (knownInfo) {
                    results.push({
                        address,
                        symbol: knownInfo.symbol,
                        name: knownInfo.name,
                        price: 0,
                        prevPrice: 0,
                        change24h: 0,
                        volume24h: 0,
                        logoURI: knownInfo.logoURI,
                        isFavorite: !DEFAULT_TOKENS.includes(address) && address !== SHULEVITZ_MINT,
                        priceDirection: "neutral"
                    });
                }
            } catch (error) {
                console.error(`Error fetching ${address}:`, error);
            }
        }

        return results;
    }, []);

    const loadTokens = useCallback(async () => {
        let addresses = [...DEFAULT_TOKENS, SHULEVITZ_MINT];

        if (publicKey) {
            const userFavorites = await getFavoriteTokens(publicKey.toString());
            addresses = [...new Set([...addresses, ...userFavorites])];
        }

        const tokenData = await fetchPricesForTokens(addresses);
        setTokens(tokenData);
        setLoading(false);
        setLastUpdate(new Date());
    }, [publicKey, fetchPricesForTokens]);

    useEffect(() => {
        loadTokens();
        const interval = setInterval(loadTokens, UPDATE_INTERVAL);
        return () => clearInterval(interval);
    }, [loadTokens]);

    const handleAddToken = async (result: SearchResult) => {
        if (!publicKey) return;
        setAddingToken(result.address);
        try {
            await addFavoriteToken(publicKey.toString(), result.address);
            TOKEN_INFO[result.address] = { symbol: result.symbol, name: result.name, logoURI: result.logoURI || "" };
            setSearchQuery("");
            setSearchResults([]);
            setShowAddModal(false);
            loadTokens();
        } finally {
            setAddingToken(null);
        }
    };

    const handleRemoveToken = async (address: string) => {
        if (!publicKey) return;
        await removeFavoriteToken(publicKey.toString(), address);
        loadTokens();
    };

    const formatPrice = (price: number) => {
        if (price < 0.0001) return `$${price.toExponential(2)}`;
        if (price < 1) return `$${price.toFixed(6)}`;
        return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatVolume = (vol: number) => {
        if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
        if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
        return `$${vol.toFixed(0)}`;
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Star size={14} className="text-yellow-500" />
                    <h3 className="text-sm font-bold text-white">Watchlist</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <Zap size={10} className="text-green-400" />
                        <span className="text-[9px] text-green-400 font-mono">LIVE</span>
                    </div>
                    {connected && (
                        <button
                            onClick={() => setShowAddModal(!showAddModal)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                            {showAddModal ? <X size={14} className="text-muted-foreground" /> : <Plus size={14} className="text-primary" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Search Modal */}
            {showAddModal && (
                <div className="p-3 border-b border-white/5 bg-black/60">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by token name..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-muted-foreground outline-none focus:border-primary"
                            autoFocus
                        />
                        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
                    </div>

                    {searchResults.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {searchResults.map((result) => (
                                <button
                                    key={result.address}
                                    onClick={() => handleAddToken(result)}
                                    disabled={addingToken === result.address}
                                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors text-left disabled:opacity-50"
                                >
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
                                        {result.symbol.slice(0, 2)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white text-sm truncate">{result.symbol}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">{result.name}</div>
                                    </div>
                                    {addingToken === result.address ? <Loader2 size={14} className="animate-spin text-primary" /> : <Plus size={14} className="text-primary" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">No tokens found</p>
                    )}
                </div>
            )}

            {/* Token List */}
            <div className="divide-y divide-white/5">
                {loading ? (
                    <div className="p-4 space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center justify-between animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10"></div>
                                    <div className="space-y-1">
                                        <div className="w-16 h-3 bg-white/10 rounded"></div>
                                        <div className="w-12 h-2 bg-white/5 rounded"></div>
                                    </div>
                                </div>
                                <div className="w-16 h-4 bg-white/10 rounded"></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    tokens.map((token) => (
                        <div
                            key={token.address}
                            className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                {token.logoURI ? (
                                    <img
                                        src={token.logoURI}
                                        alt={token.symbol}
                                        className="w-8 h-8 rounded-full bg-white/10"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                ) : null}
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-white border border-white/10 ${token.logoURI ? 'hidden' : ''}`}>
                                    {token.symbol.slice(0, 2)}
                                </div>
                                <div>
                                    <div className="font-bold text-white text-sm flex items-center gap-1">
                                        {token.symbol}
                                        {token.isFavorite && connected && (
                                            <button
                                                onClick={() => handleRemoveToken(token.address)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/10 rounded"
                                            >
                                                <X size={10} className="text-muted-foreground" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        Vol: {formatVolume(token.volume24h)}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`font-mono text-sm transition-colors duration-500 ${token.priceDirection === "up" ? "text-green-400" :
                                    token.priceDirection === "down" ? "text-red-400" : "text-white"
                                    }`}>
                                    {formatPrice(token.price)}
                                </div>
                                <div className={`flex items-center justify-end gap-1 text-[10px] ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                    {token.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                    {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground">
                    {connected ? "Click + to search" : "Connect wallet to customize"}
                </span>
                <span className="text-[9px] text-muted-foreground font-mono">
                    ⚡ 5s updates
                </span>
            </div>
        </div>
    );
}
