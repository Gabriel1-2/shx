import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface PortfolioItem {
    mint: string;
    symbol: string; // Enriched via Jupiter Token List or Fallback
    balance: number;
    price: number;
    valueUSD: number;
    logoURI?: string;
}

export function usePortfolio() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalValue, setTotalValue] = useState(0);

    const fetchPortfolio = useCallback(async () => {
        if (!publicKey) return;
        setLoading(true);
        try {
            // 1. Fetch SOL Balance
            const solBalanceInfo = await connection.getBalance(publicKey);
            const solBalance = solBalanceInfo / 1e9;

            // 2. Fetch SPL Accounts
            const parsedTokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: TOKEN_PROGRAM_ID
            });

            const items: { mint: string; balance: number; decimals: number }[] = [];

            // Add SOL
            if (solBalance > 0) {
                items.push({
                    mint: "So11111111111111111111111111111111111111112",
                    balance: solBalance,
                    decimals: 9
                });
            }

            // Add SPL Tokens
            parsedTokenAccounts.value.forEach((account) => {
                const info = account.account.data.parsed.info;
                const balance = info.tokenAmount.uiAmount;
                if (balance > 0) {
                    items.push({
                        mint: info.mint,
                        balance: balance,
                        decimals: info.tokenAmount.decimals
                    });
                }
            });

            if (items.length === 0) {
                setPortfolio([]);
                setTotalValue(0);
                setLoading(false);
                return;
            }

            // 3. Enrich with Prices (Bulk Fetch)
            const mints = items.map(i => i.mint).join(",");
            // Chunking might be needed if user has > 100 tokens, but for now strict list is ok
            const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${mints}`);
            const priceData = await priceRes.json();

            // 4. Enrich with Meta (Jup Token List - Simplified or Just use Price API extra info if available, 
            // but Price API v2 doesn't give symbols usually. 
            // We'll use a local map for majors + generic fallback or fetch strict list if needed.
            // For MVP, we'll try to get symbol from a public token list endpoint or just use truncated mint)

            // Actually, let's fetch the Strict List once to map mints to symbols/logos
            const tokenListRes = await fetch("https://token.jup.ag/strict");
            const tokenList = await tokenListRes.json();
            const tokenMap = new Map<string, any>(tokenList.map((t: any) => [t.address, t]));

            const finalPortfolio: PortfolioItem[] = items.map(item => {
                const priceInfo = priceData?.data?.[item.mint];
                const price = priceInfo?.price ? parseFloat(priceInfo.price) : 0;
                const tokenInfo = tokenMap.get(item.mint);

                return {
                    mint: item.mint,
                    symbol: tokenInfo?.symbol || (item.mint === "So11111111111111111111111111111111111111112" ? "SOL" : item.mint.slice(0, 4)),
                    balance: item.balance,
                    price: price,
                    valueUSD: item.balance * price,
                    logoURI: tokenInfo?.logoURI
                };
            });

            // 5. Sort by Value Descending
            finalPortfolio.sort((a, b) => b.valueUSD - a.valueUSD);

            setPortfolio(finalPortfolio);
            setTotalValue(finalPortfolio.reduce((acc, curr) => acc + curr.valueUSD, 0));

        } catch (error) {
            console.error("Portfolio Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    }, [connection, publicKey]);

    useEffect(() => {
        fetchPortfolio();
    }, [fetchPortfolio]);

    return { portfolio, totalValue, loading, refresh: fetchPortfolio };
}
