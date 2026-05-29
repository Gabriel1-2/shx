import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress } from "@solana/spl-token";

export function useTokenBalance(tokenMint: string, decimals: number = 9) {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!publicKey || !tokenMint) {
            setBalance(0);
            return;
        }

        const fetchBalance = async () => {
            setLoading(true);
            try {
                // Handle Native SOL
                if (tokenMint === "So11111111111111111111111111111111111111112") {
                    const bal = await connection.getBalance(publicKey);
                    setBalance(bal / Math.pow(10, decimals));
                    return;
                }

                // Handle SPL Tokens - Check ATA directly
                const token = new PublicKey(tokenMint);
                const owner = publicKey;
                const ata = await getAssociatedTokenAddress(token, owner);
                const response = await connection.getParsedAccountInfo(ata);

                if (response.value) {
                    const data = response.value.data as any;
                    setBalance(data.parsed.info.tokenAmount.uiAmount || 0);
                } else {
                    setBalance(0);
                }
            } catch (err) {
                console.error("Failed to fetch balance", err);
                setBalance(0);
            } finally {
                setLoading(false);
            }
        };

        fetchBalance();
        // Poll every 30s
        const interval = setInterval(fetchBalance, 30000);
        return () => clearInterval(interval);

    }, [connection, publicKey, tokenMint, decimals]);

    return { balance, loading };
}

/**
 * Fetches live token price from DexScreener with:
 * - 60-second polling interval
 * - 3 retry attempts with exponential backoff
 * - CoinGecko fallback for SOL
 */
export function useTokenPrice(tokenMint: string) {
    const [data, setData] = useState({ price: 0, pairAddress: "" });

    useEffect(() => {
        if (!tokenMint) return;

        const fetchWithRetry = async (url: string, retries = 3): Promise<Response | null> => {
            for (let i = 0; i < retries; i++) {
                try {
                    const res = await fetch(url);
                    if (res.ok) return res;
                    // Rate limited - wait and retry
                    if (res.status === 429) {
                        await new Promise(r => setTimeout(r, (i + 1) * 2000));
                        continue;
                    }
                    return res;
                } catch {
                    if (i < retries - 1) {
                        await new Promise(r => setTimeout(r, (i + 1) * 1500));
                    }
                }
            }
            return null;
        };

        const fetchPrice = async () => {
            // USDC hardcode
            if (tokenMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
                setData({ price: 1, pairAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" });
                return;
            }

            try {
                const res = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
                if (res?.ok) {
                    const apiData = await res.json();
                    if (apiData.pairs && apiData.pairs.length > 0) {
                        const sortedPairs = [...apiData.pairs].sort(
                            (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
                        );
                        const bestPair = sortedPairs[0];
                        const price = parseFloat(bestPair.priceUsd) || 0;
                        if (price > 0) {
                            setData({ price, pairAddress: bestPair.pairAddress });
                            return;
                        }
                    }
                }

                // Fallback: CoinGecko for SOL
                if (tokenMint === "So11111111111111111111111111111111111111112") {
                    const cgRes = await fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
                    if (cgRes?.ok) {
                        const cgData = await cgRes.json();
                        if (cgData.solana?.usd) {
                            setData({ price: cgData.solana.usd, pairAddress: "" });
                            return;
                        }
                    }
                }

                // Fallback: Jupiter Price API v2 for any token
                const jupRes = await fetchWithRetry(`https://api.jup.ag/price/v2?ids=${tokenMint}`);
                if (jupRes?.ok) {
                    const jupData = await jupRes.json();
                    const jupPrice = jupData?.data?.[tokenMint]?.price;
                    if (jupPrice) {
                        setData({ price: parseFloat(jupPrice), pairAddress: "" });
                    }
                }
            } catch (e) {
                console.error("Price fetch failed", e);
            }
        };

        fetchPrice();
        // Poll every 60 seconds
        const interval = setInterval(fetchPrice, 60000);
        return () => clearInterval(interval);
    }, [tokenMint]);

    return data;
}
