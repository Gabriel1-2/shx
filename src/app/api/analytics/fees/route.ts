import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * GET /api/analytics/fees
 * 
 * Returns aggregate fee data for the platform dashboard.
 * Shows total fees, fees by source, and recent fee events.
 */
export async function GET() {
    if (!adminDb) {
        return NextResponse.json({ error: "Firebase Admin not configured" }, { status: 500 });
    }

    try {
        // 1. Aggregate fees from fee_ledger
        const ledgerSnapshot = await adminDb.collection("fee_ledger")
            .orderBy("timestamp", "desc")
            .limit(200)
            .get();

        let totalFees = 0;
        const bySource: Record<string, { count: number; totalUsd: number }> = {
            swap: { count: 0, totalUsd: 0 },
            limit: { count: 0, totalUsd: 0 },
            dca: { count: 0, totalUsd: 0 },
            agent: { count: 0, totalUsd: 0 },
        };

        const recentFees: Array<{
            id: string;
            wallet: string;
            feeUsd: number;
            source: string;
            timestamp: string | null;
        }> = [];

        ledgerSnapshot.forEach((doc) => {
            const data = doc.data();
            const feeUsd = data.feeUsd || 0;
            totalFees += feeUsd;

            const source = data.source || "swap";
            if (bySource[source]) {
                bySource[source].count++;
                bySource[source].totalUsd += feeUsd;
            }

            if (recentFees.length < 20) {
                recentFees.push({
                    id: doc.id,
                    wallet: data.wallet || "",
                    feeUsd,
                    source,
                    timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
                });
            }
        });

        // 2. Also get the all-time total from users collection (for cross-check)
        const usersSnapshot = await adminDb.collection("users").get();
        let usersTotalFees = 0;
        let uniqueFeePayingUsers = 0;

        usersSnapshot.forEach((doc) => {
            const fees = doc.data().totalFeesPaid || 0;
            usersTotalFees += fees;
            if (fees > 0) uniqueFeePayingUsers++;
        });

        return NextResponse.json({
            ledger: {
                totalFees: Math.round(totalFees * 100) / 100,
                eventCount: ledgerSnapshot.size,
                bySource,
            },
            users: {
                totalFees: Math.round(usersTotalFees * 100) / 100,
                uniqueFeePayingUsers,
            },
            recentFees,
        });

    } catch (error: any) {
        console.error("[Fees API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
