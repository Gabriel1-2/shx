import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

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

                // Handle SPL Tokens
                // Note: In a production app, we might use getParsedTokenAccountsByOwner once and cache it
                // usage of getParsedTokenAccountsByOwner is rate-limited on free RPCs, so be careful.
                // For "Harder / Pro" version, we try to use the specific account fetch if possible, 
                // but finding the ATA address requires client-side derivation.

                // Simplified approach: Get all accounts and find match (heavier but easier to implement)
                const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
                });

                const match = accounts.value.find(
                    (account) => account.account.data.parsed.info.mint === tokenMint
                );

                if (match) {
                    setBalance(match.account.data.parsed.info.tokenAmount.uiAmount || 0);
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
    const [price, setPrice] = useState<number>(0);

    useEffect(() => {
        if (!tokenMint) return;

        const fetchPrice = async () => {
            // USDC hardcode
            if (tokenMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
                setPrice(1);
                return;
            }

            try {
                const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
                const data = await res.json();
                if (data.pairs && data.pairs.length > 0) {
                    setPrice(parseFloat(data.pairs[0].priceUsd));
                }
            } catch (e) {
                console.error("Price fetch failed", e);
            }
        };

        fetchPrice();
    }, [tokenMint]);

    return price;
}
