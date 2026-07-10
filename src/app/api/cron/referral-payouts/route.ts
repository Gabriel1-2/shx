import { NextResponse } from "next/server";
import { processPendingPayouts } from "@/lib/referralPayout";

export const maxDuration = 300;

/**
 * Sweep users with claimable ≥ $5 and auto-send USDC.
 * Secure with CRON_SECRET (same as daily reset).
 */
export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const result = await processPendingPayouts(40);
        console.log(
            `[Cron] referral-payouts processed=${result.processed} paid=${result.paid}`
        );
        return NextResponse.json({ success: true, ...result });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Cron error";
        console.error("[Cron] referral-payouts:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
