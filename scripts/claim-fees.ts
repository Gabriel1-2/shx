import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { ReferralProvider } from "@jup-ag/referral-sdk";
import bs58 from "bs58";
import dotenv from "dotenv";

// Load env vars
dotenv.config();

// The Jupiter Referral Project Account for SHX Exchange
const REFERRAL_PUBKEY = new PublicKey("9rvZ5CC86oFWgwej21DMPR83LSMBoDehrNe6v6V7AAeg");
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

async function main() {
    const pk = process.env.REFERRAL_PRIVATE_KEY;
    if (!pk) {
        console.error("❌ Please set REFERRAL_PRIVATE_KEY in your .env file");
        console.log("Format: REFERRAL_PRIVATE_KEY=your_base58_private_key_here");
        process.exit(1);
    }

    // Initialize Wallet from base58 private key string
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

    console.log(`\n🔍 Scanning for claimable fee accounts for referral project: ${REFERRAL_PUBKEY.toString()}...`);

    try {
        // `claimAllV2` retrieves all pending fee accounts and batches them into optimal
        // transactions (usually up to 5 token claims per transaction to avoid tx size limits).
        const claimTxs = await referralProvider.claimAllV2(REFERRAL_PUBKEY, wallet.publicKey);

        if (claimTxs.length === 0) {
            console.log("✅ No fees to claim. You are all caught up!");
            return;
        }

        console.log(`💰 Found uncollected fees! Generated ${claimTxs.length} batched transaction(s) to claim everything.`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < claimTxs.length; i++) {
            const tx = claimTxs[i];
            console.log(`\n⏳ Sending batch ${i + 1} of ${claimTxs.length}...`);
            
            try {
                // Sign and execute the transaction
                const signature = await sendAndConfirmTransaction(connection, tx, [wallet], {
                    commitment: "confirmed",
                    // skipPreflight is sometimes necessary for Jupiter SDK transactions
                    skipPreflight: true 
                });
                console.log(`✅ Batch ${i + 1} Claimed Successfully!`);
                console.log(`🔗 Tx Hash: https://solscan.io/tx/${signature}`);
                successCount++;
            } catch (err: any) {
                console.error(`❌ Batch ${i + 1} Failed:`, err.message);
                failCount++;
            }
        }

        console.log(`\n🎉 Fee sweeping complete!`);
        console.log(`📊 Summary -> Successful batches: ${successCount} | Failed batches: ${failCount}`);

    } catch (error) {
        console.error("\n❌ Fatal error claiming fees:", error);
    }
}

main();
