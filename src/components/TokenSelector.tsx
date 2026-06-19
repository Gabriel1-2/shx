"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { ChevronDown, Check, Search, Loader2 } from "lucide-react";
import { APP_TOKENS, TokenInfo } from "@/lib/constants";

interface TokenSelectorProps {
    value: TokenInfo;
    onChange: (token: TokenInfo) => void;
    label?: string;
}

export default function TokenSelector({ value, onChange, label }: TokenSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [tokens, setTokens] = useState<TokenInfo[]>(APP_TOKENS);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Fetch Jupiter strict list on mount
    useEffect(() => {
        const fetchTokens = async () => {
            try {
                setLoading(true);
                const res = await fetch("https://token.jup.ag/strict");
                const data = await res.json();
                
                interface JupTokenRaw {
                    symbol: string;
                    name: string;
                    address: string;
                    logoURI: string;
                    decimals: number;
                }
                // Map Jupiter tokens to our TokenInfo structure
                const jupTokens: TokenInfo[] = data.map((t: JupTokenRaw) => ({
                    symbol: t.symbol,
                    name: t.name,
                    address: t.address,
                    logo: t.logoURI,
                    isImage: true,
                    decimals: t.decimals,
                }));

                // Deduplicate and merge: keep our custom SHX token at the top, then SOL, USDC, then the rest
                const customTokens = APP_TOKENS.filter(t => t.symbol === "SHX" || t.symbol === "SOL" || t.symbol === "USDC");
                const customAddresses = new Set(customTokens.map(t => t.address));
                
                const filteredJup = jupTokens.filter(t => !customAddresses.has(t.address));
                setTokens([...customTokens, ...filteredJup]);
            } catch (err) {
                console.error("Failed to load Jupiter tokens", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTokens();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredTokens = useMemo(() => {
        if (!search) return tokens.slice(0, 50); // Show top 50 by default for performance
        const lowerSearch = search.toLowerCase();
        return tokens.filter(
            (t) => t.symbol.toLowerCase().includes(lowerSearch) || t.name.toLowerCase().includes(lowerSearch) || t.address.toLowerCase() === lowerSearch
        ).slice(0, 100);
    }, [search, tokens]);

    return (
        <div className="relative w-full" ref={ref}>
            {label && <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</label>}
            
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-lg px-3 py-2.5 transition-all text-sm font-bold text-white group"
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {value.isImage && value.logo ? (
                        <Image src={value.logo} alt={value.symbol} width={20} height={20} className="rounded-full flex-shrink-0" unoptimized />
                    ) : (
                        <span className="text-base flex-shrink-0">{value.logo}</span>
                    )}
                    <span className="truncate">{value.symbol}</span>
                </div>
                <ChevronDown size={14} className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180 text-white" : "group-hover:text-white"}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-[240px] mt-1 bg-[#111] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    
                    {/* Search Bar */}
                    <div className="p-2 border-b border-white/[0.06]">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input 
                                type="text"
                                placeholder="Search symbol or mint..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Token List */}
                    <div className="max-h-60 overflow-y-auto p-1 scrollbar-hide">
                        {loading && tokens.length === APP_TOKENS.length ? (
                            <div className="flex items-center justify-center p-4 text-muted-foreground">
                                <Loader2 size={16} className="animate-spin mr-2" />
                                <span className="text-xs">Loading tokens...</span>
                            </div>
                        ) : filteredTokens.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">No tokens found</div>
                        ) : (
                            filteredTokens.map((token) => (
                                <button
                                    key={token.address}
                                    onClick={() => {
                                        onChange(token);
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                        value.address === token.address
                                            ? "bg-white/[0.08] text-white"
                                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-white"
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        {token.isImage && token.logo ? (
                                            <Image src={token.logo} alt={token.symbol} width={22} height={22} className="rounded-full opacity-90 flex-shrink-0" unoptimized />
                                        ) : (
                                            <span className="text-lg opacity-90 flex-shrink-0">{token.logo}</span>
                                        )}
                                        <div className="flex flex-col items-start leading-none gap-1 overflow-hidden">
                                            <span className="font-bold truncate max-w-[120px]">{token.symbol}</span>
                                            <span className="text-[10px] opacity-70 truncate max-w-[120px]">{token.name}</span>
                                        </div>
                                    </div>
                                    {value.address === token.address && <Check size={14} className="text-green-400 flex-shrink-0" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
