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
                // Primary: DexScreener (Rich data)
                const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.pairs && data.pairs.length > 0) {
                        setPrice(parseFloat(data.pairs[0].priceUsd));
                        return;
                    }
                }

                // Fallback: Jupiter Price API (Reliable for majors/long-tail)
                console.log("DexScreener failed, trying Jup...");
                const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${tokenMint}`);
                const jupData = await jupRes.json();
                if (jupData.data && jupData.data[tokenMint]) {
                    setPrice(parseFloat(jupData.data[tokenMint].price));
                }
            } catch (e) {
                console.error("Price fetch failed", e);
            }
        };

        fetchPrice();
    }, [tokenMint]);

    return price;
}
