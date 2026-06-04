"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronDown, Check } from "lucide-react";
import { APP_TOKENS, TokenInfo } from "@/lib/constants";

interface TokenSelectorProps {
    value: TokenInfo;
    onChange: (token: TokenInfo) => void;
    label?: string;
}

export default function TokenSelector({ value, onChange, label }: TokenSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={ref}>
            {label && <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</label>}
            
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-lg px-3 py-2.5 transition-all text-sm font-bold text-white group"
            >
                <div className="flex items-center gap-2">
                    {value.isImage ? (
                        <Image src={value.logo} alt={value.symbol} width={20} height={20} className="rounded-full" />
                    ) : (
                        <span className="text-base">{value.logo}</span>
                    )}
                    <span>{value.symbol}</span>
                </div>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180 text-white" : "group-hover:text-white"}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[#111] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-60 overflow-y-auto p-1 scrollbar-hide">
                        {APP_TOKENS.map((token) => (
                            <button
                                key={token.address}
                                onClick={() => {
                                    onChange(token);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                    value.address === token.address
                                        ? "bg-white/[0.08] text-white"
                                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-white"
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    {token.isImage ? (
                                        <Image src={token.logo} alt={token.symbol} width={22} height={22} className="rounded-full opacity-90" />
                                    ) : (
                                        <span className="text-lg opacity-90">{token.logo}</span>
                                    )}
                                    <div className="flex flex-col items-start leading-none gap-1">
                                        <span className="font-bold">{token.symbol}</span>
                                        <span className="text-[10px] opacity-70">{token.name}</span>
                                    </div>
                                </div>
                                {value.address === token.address && <Check size={14} className="text-green-400" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
