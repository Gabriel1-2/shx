
import { createClient } from '@supabase/supabase-js';

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function testQuote() {
    const amount = 100000000; // 0.1 SOL
    const slippageBps = 50; // 0.5%
    const platformFeeBps = 50; // 0.5%

    const params = new URLSearchParams({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        platformFeeBps: platformFeeBps.toString(),
    });

    const endpoints = [
        `https://public.jupiterapi.com/quote?${params.toString()}`,
    ];

    for (const url of endpoints) {
        console.log("\n---------------------------------------------------");
        console.log("Testing:", url);
        try {
            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Origin": "https://jup.ag",
                    "Referer": "https://jup.ag/"
                }
            });
            console.log(`Status: ${res.status} ${res.statusText}`);
            if (res.ok) {
                console.log("✅ SUCCESS");
                // console.log(await res.json()); // Don't spam output
            } else {
                console.log("❌ FAILED");
                console.log("Body:", await res.text());
            }
        } catch (error: any) {
            console.error("❌ EXCEPTION:", error.message);
        }
    }
}

testQuote();
