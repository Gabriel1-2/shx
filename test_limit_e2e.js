/**
 * END-TO-END Limit Order Test
 * 
 * This script simulates the EXACT flow that LimitOrderPanel.tsx + /api/limit/create route.ts
 * perform, step by step, hitting Jupiter's live production APIs.
 * 
 * Steps tested:
 *   1. request-challenge  → POST /trigger/v2/auth/challenge
 *   2. sign challenge     → nacl.sign.detached (simulates wallet signMessage)
 *   3. verify-challenge   → POST /trigger/v2/auth/verify  → JWT
 *   4. register-vault     → GET  /trigger/v2/vault/register
 *   5. deposit-craft      → POST /trigger/v2/deposit/craft → unsigned tx
 *   6. sign deposit tx    → Keypair.sign (simulates wallet signTransaction)
 *   7. submit-order       → POST /trigger/v2/orders/price  → order confirmation
 */

const bs58 = require("bs58");
const nacl = require("tweetnacl");
const { Keypair, VersionedTransaction } = require("@solana/web3.js");

const API_KEY = "jup_2a91a815fa117b802471d3fc8e3b3cd62ced910bbe2f6ca67560665ef7f87e37";
const BASE = "https://api.jup.ag";

// USDC -> SOL buy limit (most common user flow)
const INPUT_MINT  = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
const OUTPUT_MINT = "So11111111111111111111111111111111111111112";      // SOL
const IN_AMOUNT   = "10000000"; // 10 USDC (6 decimals)
const TRIGGER_PRICE_USD = 50.0; // Buy SOL when price drops below $50
const SIDE = "buy";

async function safeJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { error: "Non-JSON", text }; }
}

function log(step, status, detail) {
    const icon = status === "OK" ? "✅" : status === "FAIL" ? "❌" : "⏳";
    console.log(`${icon} [Step ${step}] ${detail}`);
}

async function main() {
    console.log("=== LIMIT ORDER E2E TEST ===\n");

    const kp = Keypair.generate();
    const wallet = kp.publicKey.toString();
    console.log(`Test wallet: ${wallet}\n`);

    // ── Step 1: Request Challenge ──────────────────────────
    log(1, "WAIT", "Requesting auth challenge...");
    const challengeRes = await fetch(`${BASE}/trigger/v2/auth/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ walletPubkey: wallet, type: "message" }),
    });
    const challengeData = await safeJson(challengeRes);
    if (!challengeRes.ok || !challengeData.challenge) {
        log(1, "FAIL", `Challenge failed: ${JSON.stringify(challengeData)}`);
        return;
    }
    log(1, "OK", `Got challenge (${challengeData.challenge.substring(0, 60)}...)`);

    // ── Step 2: Sign Challenge ────────────────────────────
    log(2, "WAIT", "Signing challenge with nacl...");
    const messageBytes = new TextEncoder().encode(challengeData.challenge);
    const sig = nacl.sign.detached(messageBytes, kp.secretKey);
    const base58Sig = bs58.encode(sig);
    log(2, "OK", `Signature: ${base58Sig.substring(0, 30)}...`);

    // ── Step 3: Verify Challenge → JWT ────────────────────
    log(3, "WAIT", "Verifying signature → getting JWT...");
    const verifyRes = await fetch(`${BASE}/trigger/v2/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ type: "message", walletPubkey: wallet, signature: base58Sig }),
    });
    const verifyData = await safeJson(verifyRes);
    if (!verifyRes.ok || !verifyData.token) {
        log(3, "FAIL", `Verify failed: ${JSON.stringify(verifyData)}`);
        return;
    }
    const jwt = verifyData.token;
    log(3, "OK", `JWT acquired (${jwt.substring(0, 30)}...)`);

    // ── Step 4: Register Vault ────────────────────────────
    log(4, "WAIT", "Registering vault...");
    const regRes = await fetch(`${BASE}/trigger/v2/vault/register`, {
        headers: { "x-api-key": API_KEY, "Authorization": `Bearer ${jwt}` },
    });
    const regData = await safeJson(regRes);
    if (!regRes.ok && !(regRes.status === 409)) {
        log(4, "FAIL", `Register failed: ${JSON.stringify(regData)}`);
        return;
    }
    log(4, "OK", `Vault registered (status ${regRes.status})`);

    // ── Step 5: Deposit Craft ─────────────────────────────
    log(5, "WAIT", "Crafting deposit transaction...");
    const craftPayload = {
        userAddress: wallet,
        inputMint: INPUT_MINT,
        outputMint: OUTPUT_MINT,
        amount: IN_AMOUNT,
        orderType: "price",
        orderSubType: "single",
    };
    console.log(`   Craft payload: ${JSON.stringify(craftPayload)}`);
    
    const craftRes = await fetch(`${BASE}/trigger/v2/deposit/craft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "Authorization": `Bearer ${jwt}` },
        body: JSON.stringify(craftPayload),
    });
    const craftData = await safeJson(craftRes);
    if (!craftRes.ok || !craftData.transaction) {
        log(5, "FAIL", `Craft failed: ${JSON.stringify(craftData)}`);
        return;
    }
    log(5, "OK", `Got unsigned tx (requestId: ${craftData.requestId})`);

    // ── Step 6: Sign Deposit Transaction ──────────────────
    log(6, "WAIT", "Deserializing & signing deposit tx...");
    const txBuffer = Buffer.from(craftData.transaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuffer);
    console.log(`   TX version: ${tx.version !== undefined ? 'V0' : 'Legacy'}`);
    console.log(`   TX signers needed: ${tx.message.header.numRequiredSignatures}`);
    
    tx.sign([kp]);
    
    // Serialize WITHOUT strict sig check (matches our frontend fix)
    const signedTxBase64 = Buffer.from(tx.serialize()).toString("base64");
    log(6, "OK", `Signed tx (${signedTxBase64.substring(0, 40)}...)`);

    // ── Step 7: Submit Order ──────────────────────────────
    log(7, "WAIT", "Submitting order to Jupiter...");
    
    // This is the EXACT payload our route.ts builds:
    const triggerCondition = SIDE === "buy" ? "below" : "above";
    const expiryMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    const orderPayload = {
        orderType: "single",
        depositRequestId: craftData.requestId,
        depositSignedTx: signedTxBase64,
        userPubkey: wallet,
        inputMint: INPUT_MINT,
        inputAmount: IN_AMOUNT,
        outputMint: OUTPUT_MINT,
        triggerMint: SIDE === "sell" ? INPUT_MINT : OUTPUT_MINT,
        expiresAt: Date.now() + expiryMs,
        triggerCondition,
        triggerPriceUsd: TRIGGER_PRICE_USD,
        slippageBps: 100,
    };

    console.log(`   Order payload: ${JSON.stringify(orderPayload, null, 2)}`);

    const submitRes = await fetch(`${BASE}/trigger/v2/orders/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "Authorization": `Bearer ${jwt}` },
        body: JSON.stringify(orderPayload),
    });
    const submitData = await safeJson(submitRes);
    
    if (!submitRes.ok) {
        log(7, "FAIL", `Submit REJECTED: ${JSON.stringify(submitData)}`);
        console.log("\n❌ LIMIT ORDER FLOW FAILED AT SUBMIT STEP");
        return;
    }
    
    log(7, "OK", `Order accepted! Response: ${JSON.stringify(submitData)}`);
    console.log("\n✅✅✅ LIMIT ORDER FLOW: ALL 7 STEPS PASSED ✅✅✅");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
