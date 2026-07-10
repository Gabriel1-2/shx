import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import {
    adminInitializeReferralCode,
    adminRegisterReferral,
    generateReferralCode,
} from "@/lib/adminUsers";
import { adminDb } from "@/lib/firebaseAdmin";

const BodySchema = z.object({
    action: z.enum(["init", "register", "stats"]),
    wallet: z.string().min(32).max(44),
    referralCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const rl = await rateLimit(req, 20, 60000);
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const csrf = validateInternalOrigin(req);
    if (!csrf.success) {
        return NextResponse.json({ error: csrf.error }, { status: 403 });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { action, wallet, referralCode } = parsed.data;

    if (action === "init") {
        const code = await adminInitializeReferralCode(wallet);
        return NextResponse.json({ success: true, referralCode: code });
    }

    if (action === "register") {
        if (!referralCode) {
            return NextResponse.json({ error: "referralCode required" }, { status: 400 });
        }
        const result = await adminRegisterReferral(wallet, referralCode);
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === "stats") {
        if (!adminDb) {
            return NextResponse.json({
                referralCode: generateReferralCode(wallet),
                referralCount: 0,
                referralEarnings: 0,
            });
        }
        const snap = await adminDb.collection("users").doc(wallet).get();
        const data = snap.data() || {};
        return NextResponse.json({
            referralCode: data.referralCode || generateReferralCode(wallet),
            referralCount: data.referralCount || 0,
            referralEarnings: data.referralEarnings || 0,
        });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
