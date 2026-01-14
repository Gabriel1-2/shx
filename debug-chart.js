
const BASE_URL = "https://api.geckoterminal.com/api/v2";
const TOKEN = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";

async function debug() {
    console.log("Debugging Chart Data for TOKEN:", TOKEN);

    // 1. Gecko Direct
    console.log("\n--- Step 1: GeckoTerminal Tokens Endpoint ---");
    try {
        const url = `${BASE_URL}/networks/solana/tokens/${TOKEN}/pools?page=1`;
        console.log("Fetching:", url);
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            console.log("Gecko Response Data Length:", data.data?.length || 0);
            if (data.data?.length > 0) {
                console.log("FOUND via Gecko. Pool:", data.data[0].attributes.address);
            } else {
                console.log("Gecko returned empty array.");
            }
        } else {
            console.log("Gecko Failed:", res.status, res.statusText);
        }
    } catch (e) { console.error("Gecko Error:", e.message); }

    // 2. DexScreener
    console.log("\n--- Step 2: DexScreener Fallback ---");
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN}`;
        console.log("Fetching:", url);
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            console.log("DexScreener Pairs Found:", data.pairs?.length || 0);
            if (data.pairs?.length > 0) {
                const best = data.pairs.find(p => p.chainId === 'solana' && p.quoteToken.symbol === 'SOL'); // try SOL first
                const pair = best || data.pairs[0];
                console.log("DexScreener Best Pair Address:", pair.pairAddress);
                console.log("DexScreener Pair URL:", pair.url);
                
                // 3. Try to use this Pair Address in Gecko OHLCV
                console.log("\n--- Step 3: Test Gecko OHLCV with DexScreener Address ---");
                const ohlcvUrl = `${BASE_URL}/networks/solana/pools/${pair.pairAddress}/ohlcv/hour?limit=5`;
                console.log("Fetching OHLCV:", ohlcvUrl);
                const oRes = await fetch(ohlcvUrl);
                if (oRes.ok) {
                    const oData = await oRes.json();
                    console.log("OHLCV Data Found:", oData.data.attributes.ohlcv_list?.length || 0);
                    if (oData.data.attributes.ohlcv_list?.length > 0) {
                        console.log("Sample:", oData.data.attributes.ohlcv_list[0]);
                    }
                } else {
                    console.log("Gecko OHLCV Failed (404 expected if pool not indexed):", oRes.status);
                    const txt = await oRes.text();
                    console.log("Body:", txt);
                }
            }
        }
    } catch (e) { console.error("DexScreener Error:", e.message); }
}

debug();
