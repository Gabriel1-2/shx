/**
 * Resolve Solana token logos reliably.
 *
 * DexScreener token-boosts returns `icon` as a CMS id (e.g. "vEX0kJo6063DVp7W"),
 * NOT a URL. Using it as <img src> silently breaks icons. Prefer full URLs from
 * pair.info.imageUrl, expand ids to CDN paths, then fall back to mint-based paths.
 */
import { SHULEVITZ_MINT, SOL_MINT } from "./constants";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const WIF = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
const JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

const KNOWN_LOGOS: Record<string, string> = {
    [SHULEVITZ_MINT]: "/icons/icon-192.png",
    [SOL_MINT]:
        "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    [USDC]:
        "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    [USDT]:
        "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
    [BONK]: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
    [WIF]:
        "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betiez6dqmjpbhzyjfniq.ipfs.nftstorage.link/",
    [JUP]: "https://static.jup.ag/jup/icon.png",
};

function isHttpUrl(s?: string | null): s is string {
    return !!s && /^https?:\/\//i.test(s);
}

/** DexScreener CMS ids look like short alphanumerics, no path/extension. */
function isDexCmsId(s?: string | null): s is string {
    return !!s && !s.includes("/") && !s.includes(".") && /^[A-Za-z0-9_-]{6,}$/.test(s);
}

export function dexscreenerCmsUrl(id: string, size = 64): string {
    return `https://cdn.dexscreener.com/cms/images/${id}?width=${size}&height=${size}&quality=95&format=auto`;
}

export function dexscreenerMintUrl(mint: string): string {
    return `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`;
}

export function resolveTokenImage(opts: {
    mint?: string | null;
    /** Boost API field — may be CMS id OR full URL */
    icon?: string | null;
    /** Pair info.imageUrl or similar full URL */
    imageUrl?: string | null;
    size?: number;
}): string | undefined {
    const { mint, icon, imageUrl, size = 64 } = opts;

    if (mint && KNOWN_LOGOS[mint]) return KNOWN_LOGOS[mint];
    if (isHttpUrl(imageUrl)) return imageUrl;
    if (isHttpUrl(icon)) return icon;
    if (isDexCmsId(icon)) return dexscreenerCmsUrl(icon, size);
    if (mint) return dexscreenerMintUrl(mint);
    return undefined;
}

/** Stable pastel from mint/symbol for letter avatar fallbacks */
export function tokenAvatarColor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 55% 42%)`;
}
