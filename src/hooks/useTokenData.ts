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

                // Handle SPL Tokens - Optimized: Check ATA directly
                const token = new PublicKey(tokenMint);
                const owner = publicKey;

                // Derive ATA
                const ata = await getAssociatedTokenAddress(token, owner);

                // Fetch account info
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

export function useTokenPrice(tokenMint: string) {
    const [data, setData] = useState({ price: 0, pairAddress: "" });

    useEffect(() => {
        if (!tokenMint) return;

        const fetchPrice = async () => {
            // USDC hardcode
            if (tokenMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
                setData({ price: 1, pairAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" });
                return;
            }

            try {
                const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
                if (res.ok) {
                    const apiData = await res.json();
                    if (apiData.pairs && apiData.pairs.length > 0) {
                        // Find the pair where baseToken matches the searched token
                        // DexScreener can return pairs where this token is the QUOTE, not base
                        const correctPair = apiData.pairs.find(
                            (p: any) => p.baseToken?.address?.toLowerCase() === tokenMint.toLowerCase()
                        ) || apiData.pairs[0];

                        setData({
                            price: parseFloat(correctPair.priceUsd) || 0,
                            pairAddress: correctPair.pairAddress
                        });
                        return;
                    }
                }

                // Fallback: CoinGecko for SOL
                if (tokenMint === "So11111111111111111111111111111111111111112") {
                    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
                    const cgData = await cgRes.json();
                    if (cgData.solana?.usd) {
                        setData({ price: cgData.solana.usd, pairAddress: "" });
                    }
                }
            } catch (e) {
                console.error("Price fetch failed", e);
            }
        };

        fetchPrice();
    }, [tokenMint]);

    return data;
}
