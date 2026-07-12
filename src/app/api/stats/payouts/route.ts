import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Public feed of completed referral USDC payouts (trust / social proof).
 */
export async function GET() {
    if (!adminDb) {
        return NextResponse.json({ payouts: [], totalPaidUsd: 0 });
    }

    try {
        let totalPaidUsd = 0;
        let payouts: Array<Record<string, unknown>> = [];

        try {
            const snap = await adminDb
                .collection("referral_payouts")
                .where("status", "==", "completed")
                .orderBy("completedAt", "desc")
                .limit(25)
                .get();
            payouts = snap.docs.map((d) => {
                const x = d.data();
                totalPaidUsd += Number(x.amountUsd || 0);
                return {
                    id: d.id,
                    wallet: x.wallet,
                    amountUsd: x.amountUsd,
                    signature: x.signature,
                    status: x.status,
                    completedAt: x.completedAt || null,
                    createdAt: x.createdAt || null,
                };
            });
        } catch {
            // Fallback without composite index
            const snap = await adminDb.collection("referral_payouts").limit(50).get();
            payouts = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((x: any) => x.status === "completed")
                .sort((a: any, b: any) =>
                    String(b.completedAt || b.createdAt || "").localeCompare(
                        String(a.completedAt || a.createdAt || "")
                    )
                )
                .slice(0, 25)
                .map((x: any) => {
                    totalPaidUsd += Number(x.amountUsd || 0);
                    return {
                        id: x.id,
                        wallet: x.wallet,
                        amountUsd: x.amountUsd,
                        signature: x.signature,
                        status: x.status,
                        completedAt: x.completedAt || null,
                        createdAt: x.createdAt || null,
                    };
                });
        }

        // Cross-check lifetime from users if ledger empty-ish
        if (totalPaidUsd === 0) {
            const users = await adminDb.collection("users").limit(500).get();
            users.forEach((d) => {
                totalPaidUsd += Number(d.data().referralPaidUsd || 0);
            });
        }

        return NextResponse.json(
            { payouts, totalPaidUsd },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "error";
        return NextResponse.json({ error: msg, payouts: [], totalPaidUsd: 0 }, { status: 500 });
    }
}
