import { NextRequest, NextResponse } from "next/server";
import { getLiveStats, recomputeLiveStats } from "@/lib/liveStats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/stats/live
 * Public live tracker: unique traders, volume, fees, recent activity.
 * ?recompute=1 forces full Firestore scan (admin/ops).
 */
export async function GET(req: NextRequest) {
    try {
        const force = req.nextUrl.searchParams.get("recompute") === "1";
        const stats = force ? await recomputeLiveStats() : await getLiveStats();

        return NextResponse.json(
            {
                ...stats,
                // Friendly aliases for the UI
                walletsTraded: stats.tradersAllTime,
                walletsTradedToday: stats.tradersToday,
            },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Stats error";
        console.error("[/api/stats/live]", e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
