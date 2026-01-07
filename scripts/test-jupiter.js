

const JUPITER_QUOTE_API = "https://lite-api.jup.ag/v1";

// SOL -> USDC
const inputMint = "So11111111111111111111111111111111111111112";
const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const amount = 1000000000; // 1 SOL

async function testQuote() {
    console.log("Fetching quote...");
    try {
        const url = `${JUPITER_QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
        console.log("URL:", url);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error("Error Status:", response.status);
            console.error("Error Text:", await response.text());
            return;
        }
        
        const data = await response.json();
        console.log("Success! Quote:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

testQuote();
