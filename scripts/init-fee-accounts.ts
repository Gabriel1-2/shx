import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, VersionedTransaction } from "@solana/web3.js";
import { ReferralProvider } from "@jup-ag/referral-sdk";
import bs58 from "bs58";
import dotenv from "dotenv";

// Load env vars
dotenv.config();

// Default Jupiter Referral Account for SHX Exchange
const REFERRAL_PUBKEY = new PublicKey("9rvZ5CC86oFWgwej21DMPR83LSMBoDehrNe6v6V7AAeg");
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

// Jupiter's Strict API - returns the top ~100-200 verified, highly-liquid tokens
const JUP_STRICT_LIST_URL = "https://token.jup.ag/strict";

async function main() {
    const pk = process.env.REFERRAL_PRIVATE_KEY;
    if (!pk) {
        console.error("❌ Please set REFERRAL_PRIVATE_KEY in your .env file");
        process.exit(1);
    }

    let wallet: Keypair;
    try {
        wallet = Keypair.fromSecretKey(bs58.decode(pk));
    } catch (e) {
        console.error("❌ Invalid private key format. Ensure it is a base58 string.");
        process.exit(1);
    }

    console.log(`🔑 Wallet loaded: ${wallet.publicKey.toString()}`);
    console.log(`🌐 RPC URL: ${RPC_URL}`);

    const connection = new Connection(RPC_URL, "confirmed");
    const referralProvider = new ReferralProvider(connection);

    console.log(`\n📥 Fetching Jupiter Strict Token List...`);
    const res = await fetch(JUP_STRICT_LIST_URL);
    const tokens = await res.json();
    console.log(`✅ Found ${tokens.length} highly verified tokens on Jupiter.`);

    console.log(`\n⚠️ NOTE: Initializing a token account costs ~0.002 SOL in rent.`);
    console.log(`Initializing all ${tokens.length} would cost ~${(tokens.length * 0.002).toFixed(2)} SOL.`);
    
    // We will batch transactions (up to 5 initializations per tx)
    let pendingTxs: VersionedTransaction[] = [];
    let existingCount = 0;
    let newCount = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const mintPubkey = new PublicKey(token.address);

        try {
            // Get the required initialization transaction (if it doesn't exist)
            const { tx, referralTokenAccountPubKey } = await referralProvider.initializeReferralTokenAccount({
                payerPubKey: wallet.publicKey,
                referralAccountPubKey: REFERRAL_PUBKEY,
                mint: mintPubkey
            });

            // Check if the account is already initialized
            const accountInfo = await connection.getAccountInfo(referralTokenAccountPubKey);
            
            if (accountInfo) {
                existingCount++;
            } else {
                console.log(`[+] Queuing init for ${token.symbol} (${token.address})`);
                pendingTxs.push(tx);
                newCount++;
            }
        } catch (e: any) {
            console.error(`Error checking ${token.symbol}: ${e.message}`);
        }

        // Optional: Add a small delay to avoid RPC rate limits
        await new Promise(r => setTimeout(r, 50));
    }

    console.log(`\n📊 Scan Complete!`);
    console.log(`- Already Initialized: ${existingCount}`);
    console.log(`- Need to Initialize: ${newCount}`);

    if (pendingTxs.length === 0) {
        console.log("✅ All top tokens are already initialized!");
        return;
    }

    console.log(`\n🚀 Sending ${pendingTxs.length} transactions to initialize the remaining accounts...`);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingTxs.length; i++) {
        const tx = pendingTxs[i];
        try {
            const signature = await sendAndConfirmTransaction(connection, tx as any, [wallet], {
                commitment: "confirmed",
                skipPreflight: true
            });
            console.log(`✅ Init Tx ${i + 1}/${pendingTxs.length} Success: https://solscan.io/tx/${signature}`);
            successCount++;
        } catch (e: any) {
            console.error(`❌ Init Tx ${i + 1}/${pendingTxs.length} Failed: ${e.message}`);
            failCount++;
        }
    }

    console.log(`\n🎉 Initialization complete. Successful: ${successCount}, Failed: ${failCount}`);
}

main();
