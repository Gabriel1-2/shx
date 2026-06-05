const bs58 = require('bs58');
const { Keypair } = require('@solana/web3.js');
const nacl = require('tweetnacl');

async function test() {
    try {
        const apiKey = "jup_2a91a815fa117b802471d3fc8e3b3cd62ced910bbe2f6ca67560665ef7f87e37";
        const kp = Keypair.generate();
        const wallet = kp.publicKey.toString();
        console.log("Wallet:", wallet);

        // 1. Challenge
        let res = await fetch("https://api.jup.ag/trigger/v2/auth/challenge", {
            method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({ walletPubkey: wallet, type: "message" })
        });
        let data = await res.json();
        const challenge = data.challenge;

        // 2. Sign
        const msgBytes = new TextEncoder().encode(challenge);
        const sig = nacl.sign.detached(msgBytes, kp.secretKey);
        const sig58 = bs58.encode(sig);

        // 3. Verify
        res = await fetch("https://api.jup.ag/trigger/v2/auth/verify", {
            method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({ walletPubkey: wallet, type: "message", signature: sig58 })
        });
        data = await res.json();
        const jwt = data.token;
        console.log("Got JWT");

        // 4. Register Vault
        console.log("Registering vault...");
        res = await fetch("https://api.jup.ag/trigger/v2/vault/register", {
            method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "Authorization": "Bearer " + jwt }
        });
        console.log("Register Vault:", res.status, await res.text());

        // 5. Craft with inputMint/outputMint
        console.log("\n--- Testing craft with inputMint/outputMint ---");
        res = await fetch("https://api.jup.ag/trigger/v2/deposit/craft", {
            method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "Authorization": "Bearer " + jwt },
            body: JSON.stringify({
                userAddress: wallet,
                inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
                outputMint: "So11111111111111111111111111111111111111112", // SOL
                amount: "1000000",
                orderType: "price",
                orderSubType: "single"
            })
        });
        console.log("Craft response:", await res.text());

        // 6. Craft with baseToken/quoteToken
        console.log("\n--- Testing craft with baseToken/quoteToken ---");
        res = await fetch("https://api.jup.ag/trigger/v2/deposit/craft", {
            method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "Authorization": "Bearer " + jwt },
            body: JSON.stringify({
                userAddress: wallet,
                baseToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                quoteToken: "So11111111111111111111111111111111111111112",
                amount: "1000000",
                orderType: "price",
                orderSubType: "single"
            })
        });
        console.log("Craft response:", await res.text());

    } catch(e) {
        console.error(e);
    }
}
test();
