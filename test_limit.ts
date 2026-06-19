// @ts-nocheck
import { Keypair, Connection, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import fetch from "node-fetch";
import nacl from "tweetnacl";

const LOCAL_API = "http://localhost:3000";
const MINT_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MINT_SHX = "7F1u2b2G5kC1sJ7h5z6S8qQ2v4k8v8Vz1S8qQ2v4k8v8"; // Assuming SHX or WSOL

// Setup dummy wallet
const keypair = Keypair.generate();
const walletStr = keypair.publicKey.toString();

async function runLimitTest() {
    console.log("Testing Limit Order API flow for wallet:", walletStr);

    // 1. Request Challenge
    const cRes = await fetch(`${LOCAL_API}/api/limit/create`, {
        method: "POST", headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({ action: "request-challenge", wallet: walletStr })
    });
    if (!cRes.ok) throw new Error("Challenge failed: " + await cRes.text());
    const cData = await cRes.json();
    console.log("Got challenge:", cData.challenge);

    // 2. Sign Challenge
    const msgBytes = new TextEncoder().encode(cData.challenge);
    const sig = nacl.sign.detached(msgBytes, keypair.secretKey);
    const sigBase58 = bs58.encode(sig);

    // 3. Verify Challenge -> Get JWT
    const vRes = await fetch(`${LOCAL_API}/api/limit/create`, {
        method: "POST", headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({ action: "verify-challenge", wallet: walletStr, signature: sigBase58 })
    });
    if (!vRes.ok) throw new Error("Verify failed: " + await vRes.text());
    const vData = await vRes.json();
    const jwt = vData.token;
    console.log("Got JWT:", jwt.substring(0, 20) + "...");

    // 4. Register Vault
    const rRes = await fetch(`${LOCAL_API}/api/limit/create`, {
        method: "POST", headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({ action: "register-vault", jwt })
    });
    if (!rRes.ok) throw new Error("Register failed: " + await rRes.text());
    console.log("Vault registered.");

    // 5. Deposit Craft
    const inAmount = "15000000"; // 15 USDC
    const dRes = await fetch(`${LOCAL_API}/api/limit/create`, {
        method: "POST", headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({
            action: "deposit-craft",
            wallet: walletStr,
            jwt,
            inputMint: MINT_USDC,
            outputMint: "So11111111111111111111111111111111111111112", // WSOL
            inAmount
        })
    });
    if (!dRes.ok) {
        console.log("Deposit Craft failed (expected if wallet is empty or no SOL):", await dRes.text());
        return;
    }
    const dData = await dRes.json();
    console.log("Deposit crafted. Request ID:", dData.requestId);

    // 6. Sign Deposit Tx
    const txBuffer = Buffer.from(dData.transaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuffer);
    tx.sign([keypair]);
    const signedTxBase64 = Buffer.from(tx.serialize()).toString("base64");

    // 7. Submit Order
    const sRes = await fetch(`${LOCAL_API}/api/limit/create`, {
        method: "POST", headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
        body: JSON.stringify({
            action: "submit-order",
            wallet: walletStr,
            jwt,
            depositRequestId: dData.requestId,
            signedTransaction: signedTxBase64,
            inputMint: MINT_USDC,
            outputMint: "So11111111111111111111111111111111111111112",
            inAmount,
            triggerPriceUsd: 50, // buy SOL below 50
            side: "buy",
            expirySeconds: null
        })
    });
    
    if (!sRes.ok) {
        console.log("Submit failed:", await sRes.text());
    } else {
        console.log("Order submitted successfully!", await sRes.json());
    }
}

runLimitTest().catch(console.error);
