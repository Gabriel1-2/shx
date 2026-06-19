import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";

export const maxDuration = 300; // Allow Vercel up to 5 minutes to run this (if on pro plan)

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        // Vercel cron uses a Bearer token we define in CRON_SECRET, or we can just skip it if not configured,
        // but it's best to secure it. If CRON_SECRET is set, we must match it.
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);

        const batchSize = 400; // Firestore batch limit is 500
        let batch = writeBatch(db);
        let count = 0;
        let totalReset = 0;

        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setUTCHours(0, 0, 0, 0);
        const dayId = startOfToday.getTime(); // Used for archiving

        for (const userDoc of snapshot.docs) {
            const data = userDoc.data();
            const lastDayStart = data.dayStart || 0;

            // Only reset if they haven't already been reset today
            if (lastDayStart < dayId) {
                // If they had volume/fees yesterday, archive it first
                if (data.dailyVolume > 0 || data.dailyFeesPaid > 0) {
                    const archiveRef = doc(db, "daily_snapshots", `${userDoc.id}_${lastDayStart}`);
                    batch.set(archiveRef, {
                        wallet: userDoc.id,
                        date: lastDayStart,
                        volume: data.dailyVolume || 0,
                        feesPaid: data.dailyFeesPaid || 0,
                        tradeCount: data.dailyTradeCount || 0,
                        archivedAt: Date.now()
                    });
                    count++;
                }

                // Reset the user's daily stats
                batch.update(userDoc.ref, {
                    dailyVolume: 0,
                    dailyFeesPaid: 0,
                    dailyTradeCount: 0,
                    dayStart: dayId
                });
                count++;
                totalReset++;

                // Commit the batch if we reach the limit
                if (count >= batchSize) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
        }

        // Commit remaining
        if (count > 0) {
            await batch.commit();
        }

        console.log(`[Cron] Reset daily stats for ${totalReset} users.`);
        return NextResponse.json({ success: true, resetCount: totalReset });
    } catch (error: any) {
        console.error("[Cron] Error resetting daily volume:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
