
import { PublicKey } from "@solana/web3.js";

// REPLACE THIS WITH YOUR MAIN SOL WALLET ADDRESS
export const ADMIN_WALLET_SOL = new PublicKey("JDrrSGeaeW7AR2GbVLybBjGyC2aZg942WD7GkizGTqvq");

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const SHULEVITZ_MINT = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";
export const RAYDIUM_FARM_ID = "B9mGz3CiqaU8stRXMiaj2wLH8dyfCszLg76BHAGnuEqY";

export interface TokenInfo {
    symbol: string;
    name: string;
    address: string;
    logo: string;
    isImage: boolean;
    decimals: number;
}

export const APP_TOKENS: TokenInfo[] = [
    { symbol: "SHX", name: "Shulevitz", address: SHULEVITZ_MINT, logo: "/icons/icon-192.png", isImage: true, decimals: 9 },
    { symbol: "USDC", name: "USD Coin", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", logo: "💵", isImage: false, decimals: 6 },
    { symbol: "USDT", name: "Tether", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", logo: "💵", isImage: false, decimals: 6 },
    { symbol: "SOL", name: "Solana", address: SOL_MINT, logo: "◎", isImage: false, decimals: 9 },
    { symbol: "BONK", name: "Bonk", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", logo: "🐕", isImage: false, decimals: 5 },
    { symbol: "WIF", name: "dogwifhat", address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", logo: "🎩", isImage: false, decimals: 6 },
    { symbol: "JUP", name: "Jupiter", address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", logo: "🪐", isImage: false, decimals: 6 },
];
