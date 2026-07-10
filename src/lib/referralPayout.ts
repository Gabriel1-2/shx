/**
 * Auto-pay referral credits in USDC on Solana.
 *
 * Requires env:
 *   PAYOUT_PRIVATE_KEY  (or REFERRAL_PRIVATE_KEY) — base58 keypair funded with USDC
 *   NEXT_PUBLIC_HELIUS_RPC_URL / HELIUS_RPC_URL / RPC_URL
 */
import {
    Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    Transaction,
} from "@solana/web3.js";
import {
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    getAccount,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { REFERRAL_CONFIG } from "./referralConfig";

function getPayoutKeypair(): Keypair | null {
    const raw =
        process.env.PAYOUT_PRIVATE_KEY ||
        process.env.REFERRAL_PRIVATE_KEY ||
        "";
    if (!raw) return null;
    try {
        return Keypair.fromSecretKey(bs58.decode(raw.trim()));
    } catch {
        console.error("[payout] Invalid PAYOUT_PRIVATE_KEY / REFERRAL_PRIVATE_KEY");
        return null;
    }
}

function getRpc(): string {
    return (
        process.env.HELIUS_RPC_URL ||
        process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
        process.env.RPC_URL ||
        "https://api.mainnet-beta.solana.com"
    );
}

export interface PayoutResult {
    success: boolean;
    skipped?: boolean;
    reason?: string;
    signature?: string;
    amountUsd?: number;
    explorer?: string;
}

/**
 * If wallet has claimable ≥ minPayoutUsd and cooldown passed, send USDC and zero out claimable.
 * Safe to call frequently (idempotent via payout ledger + cooldown).
 */
export async function tryAutoPayout(wallet: string): Promise<PayoutResult> {
    if (!adminDb) return { success: false, reason: "Database unavailable" };

    const userRef = adminDb.collection("users").doc(wallet);
    const snap = await userRef.get();
    if (!snap.exists) return { success: false, skipped: true, reason: "No user" };

    const data = snap.data()!;
    const claimable = Number(data.referralClaimableUsd || 0);

    if (claimable < REFERRAL_CONFIG.minPayoutUsd) {
        return {
            success: false,
            skipped: true,
            reason: `Below min payout ($${REFERRAL_CONFIG.minPayoutUsd})`,
            amountUsd: claimable,
        };
    }

    const lastAt = data.lastReferralPayoutAt
        ? new Date(data.lastReferralPayoutAt).getTime()
        : 0;
    if (Date.now() - lastAt < REFERRAL_CONFIG.payoutCooldownMs) {
        return { success: false, skipped: true, reason: "Cooldown active" };
    }

    const amountUsd = Math.min(claimable, REFERRAL_CONFIG.maxPayoutUsd);
    const keypair = getPayoutKeypair();
    if (!keypair) {
        // Queue for later when key is configured
        await userRef.set(
            {
                referralPayoutPending: true,
                referralPayoutPendingUsd: amountUsd,
                referralPayoutPendingAt: new Date().toISOString(),
            },
            { merge: true }
        );
        return {
            success: false,
            skipped: true,
            reason: "PAYOUT_PRIVATE_KEY not configured — queued pending",
            amountUsd,
        };
    }

    // Reserve balance first (prevent double-pay races)
    const reserveId = `payout-${wallet}-${Date.now()}`;
    try {
        await adminDb.runTransaction(async (t) => {
            const fresh = await t.get(userRef);
            const bal = Number(fresh.data()?.referralClaimableUsd || 0);
            if (bal < REFERRAL_CONFIG.minPayoutUsd) {
                throw new Error("INSUFFICIENT_CLAIMABLE");
            }
            const pay = Math.min(bal, REFERRAL_CONFIG.maxPayoutUsd);
            t.set(
                userRef,
                {
                    referralClaimableUsd: FieldValue.increment(-pay),
                    referralPayoutInFlight: pay,
                    referralPayoutInFlightId: reserveId,
                    lastReferralPayoutAttemptAt: new Date().toISOString(),
                },
                { merge: true }
            );
            t.set(adminDb!.collection("referral_payouts").doc(reserveId), {
                id: reserveId,
                wallet,
                amountUsd: pay,
                status: "pending",
                createdAt: new Date().toISOString(),
                timestamp: FieldValue.serverTimestamp(),
            });
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "INSUFFICIENT_CLAIMABLE") {
            return { success: false, skipped: true, reason: "Insufficient after race" };
        }
        throw e;
    }

    // Re-read reserved amount
    const after = (await userRef.get()).data()!;
    const payAmount = Number(after.referralPayoutInFlight || amountUsd);

    try {
        const signature = await sendUsdc(keypair, wallet, payAmount);

        await adminDb.runTransaction(async (t) => {
            t.set(
                userRef,
                {
                    referralPaidUsd: FieldValue.increment(payAmount),
                    referralPayoutInFlight: 0,
                    referralPayoutInFlightId: FieldValue.delete(),
                    referralPayoutPending: false,
                    lastReferralPayoutAt: new Date().toISOString(),
                    lastReferralPayoutSig: signature,
                    wallet,
                },
                { merge: true }
            );
            t.set(
                adminDb!.collection("referral_payouts").doc(reserveId),
                {
                    status: "completed",
                    signature,
                    completedAt: new Date().toISOString(),
                    amountUsd: payAmount,
                },
                { merge: true }
            );
        });

        await adminDb.collection("referral_events").add({
            type: "payout",
            wallet,
            amountUsd: payAmount,
            signature,
            mint: REFERRAL_CONFIG.payoutMint,
            createdAt: new Date().toISOString(),
            timestamp: FieldValue.serverTimestamp(),
        });

        console.log(
            `[payout] ✅ $${payAmount.toFixed(2)} USDC → ${wallet.slice(0, 8)}… sig=${signature.slice(0, 12)}…`
        );

        return {
            success: true,
            amountUsd: payAmount,
            signature,
            explorer: `https://solscan.io/tx/${signature}`,
        };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[payout] send failed, refunding claimable:", msg);

        // Refund claimable
        await adminDb.runTransaction(async (t) => {
            t.set(
                userRef,
                {
                    referralClaimableUsd: FieldValue.increment(payAmount),
                    referralPayoutInFlight: 0,
                    referralPayoutInFlightId: FieldValue.delete(),
                    lastReferralPayoutError: msg.slice(0, 500),
                },
                { merge: true }
            );
            t.set(
                adminDb!.collection("referral_payouts").doc(reserveId),
                {
                    status: "failed",
                    error: msg.slice(0, 500),
                    failedAt: new Date().toISOString(),
                },
                { merge: true }
            );
        });

        return { success: false, reason: msg, amountUsd: payAmount };
    }
}

async function sendUsdc(
    payer: Keypair,
    recipientWallet: string,
    amountUsd: number
): Promise<string> {
    const connection = new Connection(getRpc(), "confirmed");
    const mint = new PublicKey(REFERRAL_CONFIG.payoutMint);
    const recipient = new PublicKey(recipientWallet);

    const rawAmount = BigInt(
        Math.floor(amountUsd * Math.pow(10, REFERRAL_CONFIG.payoutDecimals))
    );
    if (rawAmount <= BigInt(0)) throw new Error("Amount too small");

    const fromAta = getAssociatedTokenAddressSync(mint, payer.publicKey);
    const toAta = getAssociatedTokenAddressSync(mint, recipient);

    // Ensure treasury has balance
    const fromAccount = await getAccount(connection, fromAta);
    if (fromAccount.amount < rawAmount) {
        throw new Error(
            `Treasury USDC insufficient: have ${fromAccount.amount}, need ${rawAmount}`
        );
    }

    const tx = new Transaction();

    // Create recipient ATA if missing
    try {
        await getAccount(connection, toAta);
    } catch {
        tx.add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey,
                toAta,
                recipient,
                mint,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );
    }

    tx.add(
        createTransferInstruction(
            fromAta,
            toAta,
            payer.publicKey,
            rawAmount,
            [],
            TOKEN_PROGRAM_ID
        )
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;

    const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
        commitment: "confirmed",
        maxRetries: 3,
    });

    // Confirm finality window
    await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
    );

    return sig;
}

/** Process all users with pending / high claimable balances (cron). */
export async function processPendingPayouts(limit = 25): Promise<{
    processed: number;
    paid: number;
    results: PayoutResult[];
}> {
    if (!adminDb) return { processed: 0, paid: 0, results: [] };

    const min = REFERRAL_CONFIG.minPayoutUsd;
    let candidates: string[] = [];

    try {
        const snap = await adminDb
            .collection("users")
            .where("referralClaimableUsd", ">=", min)
            .limit(limit)
            .get();
        candidates = snap.docs.map((d) => d.id);
    } catch {
        // Fallback scan
        const snap = await adminDb.collection("users").limit(300).get();
        candidates = snap.docs
            .filter((d) => Number(d.data().referralClaimableUsd || 0) >= min)
            .map((d) => d.id)
            .slice(0, limit);
    }

    const results: PayoutResult[] = [];
    let paid = 0;
    for (const w of candidates) {
        const r = await tryAutoPayout(w);
        results.push(r);
        if (r.success) paid++;
    }

    return { processed: candidates.length, paid, results };
}
