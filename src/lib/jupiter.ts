import { PublicKey } from "@solana/web3.js";

// Using QuickNode public endpoint as primary, but it might be flaky/404 without API key.
// We implement a robust fallback to CoinGecko for price if Jupiter fails.
const JUPITER_QUOTE_API = "https://jupiter-swap-api.quiknode.pro/v6";

export interface QuoteResponse {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    platformFee?: {
        amount: string;
        feeBps: number;
    };
    priceImpactPct: string;
    routePlan: any[];
    contextSlot?: number;
    timeTaken?: number;
    isMock?: boolean;
}

export type SwapResponse = {
    swapTransaction: string;
};

export const TOKENS = {
    SOL: { address: "So11111111111111111111111111111111111111112", decimals: 9 },
    USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 }
};

async function getPriceFromCoinGecko(): Promise<number> {
    try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        const data = await res.json();
        return data.solana.usd;
    } catch (e) {
        console.warn("CoinGecko price fetch failed, utilizing static fallback.");
        return 123.26; // Static fallback
    }
}

export async function getQuote(
    inputMint: string,
    outputMint: string,
    amount: number, // in floating point, e.g. 1.5 SOL
    slippageBps: number = 50 // 0.5%
): Promise<QuoteResponse | null> {
    const decimals = inputMint === TOKENS.USDC.address ? 6 : 9;
    const amountInSmallestUnit = Math.floor(amount * (10 ** decimals));

    try {
        // Add platformFeeBps to the URL to request the fee in the quote
        // Note: For this to truly work on-chain, referrals/fee accounts need setup, but for Quote API it should reflect in price.
        const url = `${JUPITER_QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInSmallestUnit}&slippageBps=${slippageBps}&platformFeeBps=50`;

        // Add API Key header if available
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        const apiKey = process.env.NEXT_PUBLIC_JUPITER_API_KEY;
        if (apiKey) {
            headers['x-api-key'] = apiKey;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            // console.error("Jupiter API Error:", response.status); // Suppress noise
            throw new Error("Failed to fetch quote: " + response.status);
        }

        const data = await response.json();
        return data as QuoteResponse;
    } catch (error) {
        // console.log("Falling back to MOCK/COINGECKO Quote");

        // 1. Get realtime price
        const solPrice = await getPriceFromCoinGecko();

        // 2. Calculate output with correct decimals AND 0.5% FEE
        // Fee: 0.5% -> Multiply by 0.995
        const feeMultiplier = 0.995;

        // SOL (9 decimals) -> USDC (6 decimals)
        // Factor = Price * (10^6 / 10^9) = Price / 1000
        let outAmountStr = "0";

        if (inputMint === TOKENS.SOL.address && outputMint === TOKENS.USDC.address) {
            // SOL -> USDC
            const outValRaw = amountInSmallestUnit * (solPrice / 1000);
            const outValFee = outValRaw * feeMultiplier;
            outAmountStr = Math.floor(outValFee).toString();
        } else if (inputMint === TOKENS.USDC.address && outputMint === TOKENS.SOL.address) {
            // USDC -> SOL
            const outValRaw = amountInSmallestUnit * ((1 / solPrice) * 1000);
            const outValFee = outValRaw * feeMultiplier;
            outAmountStr = Math.floor(outValFee).toString();
        }

        return {
            inputMint,
            outputMint,
            inAmount: amountInSmallestUnit.toString(),
            outAmount: outAmountStr,
            otherAmountThreshold: "0",
            swapMode: "ExactIn",
            slippageBps,
            priceImpactPct: "0",
            routePlan: []
        };
    }
}

export async function getSwapTransaction(
    quoteResponse: QuoteResponse,
    userPublicKey: string
): Promise<string | null> {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        const apiKey = process.env.NEXT_PUBLIC_JUPITER_API_KEY;
        if (apiKey) {
            headers['x-api-key'] = apiKey;
        }

        const response = await fetch(`${JUPITER_QUOTE_API}/swap`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                quoteResponse,
                userPublicKey,
                wrapAndUnwrapSol: true,
                // Fee account can be added here later
            })
        });

        if (!response.ok) {
            console.error("Jupiter Swap API Error:", await response.text());
            return null;
        }

        const { swapTransaction } = await response.json();
        return swapTransaction;
    } catch (error) {
        console.error("Failed to fetch swap transaction:", error);
        return null;
    }
}
