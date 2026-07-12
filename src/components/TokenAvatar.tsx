"use client";

import { useState } from "react";
import { resolveTokenImage, tokenAvatarColor } from "@/lib/tokenImage";

interface TokenAvatarProps {
    mint?: string | null;
    symbol?: string;
    icon?: string | null;
    imageUrl?: string | null;
    size?: number;
    className?: string;
}

/**
 * Token logo with automatic fallbacks:
 * full URL → CMS id expand → mint CDN → letter avatar on error/missing.
 */
export function TokenAvatar({
    mint,
    symbol = "?",
    icon,
    imageUrl,
    size = 20,
    className = "",
}: TokenAvatarProps) {
    const resolved = resolveTokenImage({ mint, icon, imageUrl, size: size * 2 });
    const [broken, setBroken] = useState(false);
    const letter = (symbol || "?").replace(/\$/g, "").slice(0, 2).toUpperCase() || "?";
    const dim = `${size}px`;

    if (!resolved || broken) {
        return (
            <div
                className={`shrink-0 rounded-full flex items-center justify-center font-black text-white border border-white/15 ${className}`}
                style={{
                    width: dim,
                    height: dim,
                    fontSize: Math.max(8, size * 0.38),
                    background: tokenAvatarColor(mint || symbol),
                }}
                aria-hidden
            >
                {letter}
            </div>
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={resolved}
            alt={symbol}
            width={size}
            height={size}
            className={`shrink-0 rounded-full object-cover bg-white/5 ${className}`}
            style={{ width: dim, height: dim }}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
        />
    );
}
