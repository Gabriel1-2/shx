/**
 * Token Balance Fetching for $SHULEVITZ
 * Uses Helius RPC to get wallet token balances and calculate USD value
 */

import { Connection, PublicKey } from "@solana/web3.js";

// Constants
const SHULEVITZ_MINT = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=e36d269b-1bf1-4c2a-9efd-47d319ca4882";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// Cache for balance lookups (reduces RPC calls)
interface BalanceCache {
    wallet: string;
    balance: number;
    usdValue: number;
    timestamp: number;
}

let balanceCache: BalanceCache | null = null;
const CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Fetch $SHULEVITZ token balance for a wallet
 * @param walletAddress - Solana wallet public key string
 * @returns Token balance (raw amount, not decimals-adjusted)
 */
export async function getShulevitzBalance(walletAddress: string): Promise<number> {
    try {
        // Check cache first
        if (balanceCache &&
            balanceCache.wallet === walletAddress &&
            Date.now() - balanceCache.timestamp < CACHE_TTL_MS) {
            console.log("[BALANCE] Returning cached balance:", balanceCache.balance);
            return balanceCache.balance;
        }

        const connection = new Connection(HELIUS_RPC, "confirmed");
        const walletPubkey = new PublicKey(walletAddress);
        const mintPubkey = new PublicKey(SHULEVITZ_MINT);

        // Get all token accounts for this wallet
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            walletPubkey,
            { programId: TOKEN_PROGRAM_ID }
        );

        // Find SHULEVITZ token account
        let balance = 0;
        for (const account of tokenAccounts.value) {
            const parsedInfo = account.account.data.parsed?.info;
            if (parsedInfo?.mint === SHULEVITZ_MINT) {
                balance = parsedInfo.tokenAmount?.uiAmount || 0;
                break;
            }
        }

        console.log("[BALANCE] Fetched SHULEVITZ balance:", balance);
        return balance;
    } catch (error) {
        console.error("[BALANCE] Error fetching balance:", error);
        return 0;
    }
}

/**
 * Fetch $SHULEVITZ price in USD
 * Uses Jupiter Price API for real-time pricing
 */
export async function getShulevitzPriceUSD(): Promise<number> {
    try {
        // Jupiter Price API
        const response = await fetch(
            `https://price.jup.ag/v6/price?ids=${SHULEVITZ_MINT}`
        );

        if (!response.ok) {
            console.warn("[PRICE] Jupiter API failed, using fallback");
            return 0;
        }

        const data = await response.json();
        const price = data.data?.[SHULEVITZ_MINT]?.price || 0;

        console.log("[PRICE] SHULEVITZ price:", price);
        return price;
    } catch (error) {
        console.error("[PRICE] Error fetching price:", error);
        return 0;
    }
}

/**
 * Get total USD value of $SHULEVITZ holdings for a wallet
 * @param walletAddress - Solana wallet public key string
 * @returns USD value of holdings
 */
export async function getShulevitzHoldingsUSD(walletAddress: string): Promise<number> {
    try {
        // Check cache
        if (balanceCache &&
            balanceCache.wallet === walletAddress &&
            Date.now() - balanceCache.timestamp < CACHE_TTL_MS) {
            console.log("[HOLDINGS] Returning cached USD value:", balanceCache.usdValue);
            return balanceCache.usdValue;
        }

        // Fetch balance and price in parallel
        const [balance, price] = await Promise.all([
            getShulevitzBalance(walletAddress),
            getShulevitzPriceUSD()
        ]);

        const usdValue = balance * price;

        // Update cache
        balanceCache = {
            wallet: walletAddress,
            balance,
            usdValue,
            timestamp: Date.now()
        };

        console.log("[HOLDINGS] USD value:", usdValue);
        return usdValue;
    } catch (error) {
        console.error("[HOLDINGS] Error calculating holdings:", error);
        return 0;
    }
}

/**
 * Clear the balance cache (useful after swaps)
 */
export function clearBalanceCache(): void {
    balanceCache = null;
}
