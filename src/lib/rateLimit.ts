import { NextRequest } from "next/server";
import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Local memory cache to prevent Firebase billing spikes during a heavy attack on a single instance.
const localRateLimitMap = new Map<string, { count: number; lastReset: number }>();

export async function rateLimit(
    req: NextRequest,
    limit: number = 20, // max requests
    windowMs: number = 60 * 1000 // 1 minute
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    const now = Date.now();
    const windowStart = now - (now % windowMs);

    // 1. Check Local Cache First (Zero-Cost Defense)
    let localRecord = localRateLimitMap.get(ip);
    if (!localRecord || localRecord.lastReset < windowStart) {
        localRecord = { count: 0, lastReset: windowStart };
    }

    if (localRecord.count >= limit) {
        // We already know locally that they are blocked. Reject instantly without hitting Firebase.
        return { success: false, limit, remaining: 0, reset: windowStart + windowMs };
    }

    // Increment local record speculatively
    localRecord.count += 1;
    localRateLimitMap.set(ip, localRecord);

    // If Firebase isn't configured, fallback to local map
    if (!adminDb) {
        if (localRecord.count > limit) {
            return { success: false, limit, remaining: 0, reset: windowStart + windowMs };
        }
        return { success: true, limit, remaining: limit - localRecord.count, reset: windowStart + windowMs };
    }

    // 2. Distributed Firebase Check
    const docId = `rl_${ip}_${windowStart}`;
    const docRef = adminDb.collection("rate_limits").doc(docId);

    try {
        // Run a transaction to ensure accurate counting across multiple instances
        const newCount = await adminDb.runTransaction(async (t) => {
            const doc = await t.get(docRef);
            let count = 1;
            
            if (doc.exists) {
                count = (doc.data()?.count || 0) + 1;
            }

            if (count > limit) {
                // Just return the count, no need to update Firebase further if already blocked.
                return count;
            }

            // Expiration timestamp for TTL (if configured in Firebase) or manual cleanup
            const expiresAt = new Date(windowStart + windowMs * 2);
            
            t.set(docRef, { 
                count, 
                expiresAt,
                ip 
            }, { merge: true });

            return count;
        });

        // Sync local record to match Firebase (handles distributed increment)
        if (newCount > localRecord.count) {
            localRecord.count = newCount;
            localRateLimitMap.set(ip, localRecord);
        }

        if (newCount > limit) {
            return { success: false, limit, remaining: 0, reset: windowStart + windowMs };
        }

        return { success: true, limit, remaining: limit - newCount, reset: windowStart + windowMs };

    } catch (error) {
        console.error("[RateLimit] Firebase Error:", error);
        // Fallback to local memory map if Firebase fails, rather than crashing the API.
        if (localRecord.count > limit) {
            return { success: false, limit, remaining: 0, reset: windowStart + windowMs };
        }
        return { success: true, limit, remaining: limit - localRecord.count, reset: windowStart + windowMs };
    }
}
