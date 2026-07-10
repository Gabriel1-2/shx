import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const maxDuration = 300;

/**
 * Daily reset via Firebase Admin (client SDK cannot write under current rules).
 * Schedule: 0 0 * * * (vercel.json)
 */
export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!adminDb) {
            return NextResponse.json(
                { error: "Firebase Admin not configured" },
                { status: 500 }
            );
        }

        const snapshot = await adminDb.collection("users").get();
        const currentDay = new Date().toISOString().split("T")[0];
        let totalReset = 0;
        let batch = adminDb.batch();
        let ops = 0;

        for (const userDoc of snapshot.docs) {
            const data = userDoc.data();
            const lastDayStart = data.dayStart;

            // Skip if already on today's dayStart (string YYYY-MM-DD)
            if (lastDayStart === currentDay) continue;

            if ((data.dailyVolume > 0 || data.dailyFeesPaid > 0) && lastDayStart) {
                const archiveRef = adminDb
                    .collection("daily_snapshots")
                    .doc(`${userDoc.id}_${lastDayStart}`);
                batch.set(archiveRef, {
                    wallet: userDoc.id,
                    date: lastDayStart,
                    volume: data.dailyVolume || 0,
                    feesPaid: data.dailyFeesPaid || 0,
                    tradeCount: data.dailyTradeCount || 0,
                    archivedAt: FieldValue.serverTimestamp(),
                });
                ops++;
            }

            batch.set(
                userDoc.ref,
                {
                    dailyVolume: 0,
                    dailyFeesPaid: 0,
                    dailyTradeCount: 0,
                    dayStart: currentDay,
                },
                { merge: true }
            );
            ops++;
            totalReset++;

            if (ops >= 400) {
                await batch.commit();
                batch = adminDb.batch();
                ops = 0;
            }
        }

        if (ops > 0) await batch.commit();

        console.log(`[Cron] Reset daily stats for ${totalReset} users.`);
        return NextResponse.json({ success: true, resetCount: totalReset });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Cron error";
        console.error("[Cron] Error resetting daily volume:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
