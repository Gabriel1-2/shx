import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { validateInternalOrigin } from "@/lib/security";
import {
    adminInitializeReferralCode,
    adminRegisterReferral,
    adminGetReferralStats,
    adminGetTopReferrers,
    generateReferralCode,
} from "@/lib/referralEngine";
import { REFERRAL_CONFIG } from "@/lib/referralConfig";
import { tryAutoPayout } from "@/lib/referralPayout";

const BodySchema = z.object({
    action: z.enum(["init", "register", "stats", "leaderboard", "config", "payout"]),
    wallet: z.string().min(32).max(44).optional(),
    referralCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const rl = await rateLimit(req, 30, 60000);
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const csrf = validateInternalOrigin(req);
    if (!csrf.success) {
        return NextResponse.json({ error: csrf.error }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { action, wallet, referralCode } = parsed.data;

    if (action === "config") {
        return NextResponse.json({
            headline: REFERRAL_CONFIG.headline,
            subhead: REFERRAL_CONFIG.subhead,
            minQualifyingVolumeUsd: REFERRAL_CONFIG.minQualifyingVolumeUsd,
            minQualifyingTrades: REFERRAL_CONFIG.minQualifyingTrades,
            baseL1FeeShare: REFERRAL_CONFIG.baseL1FeeShare,
            maxL1FeeShare:
                REFERRAL_CONFIG.affiliateTiers[REFERRAL_CONFIG.affiliateTiers.length - 1]
                    .feeShare,
            l2FeeShare: REFERRAL_CONFIG.l2FeeShare,
            refereeCashbackShare: REFERRAL_CONFIG.refereeCashbackShare,
            refereeXpMultiplier: REFERRAL_CONFIG.refereeXpMultiplier,
            signupBonusReferrerXp: REFERRAL_CONFIG.signupBonusReferrerXp,
            signupBonusRefereeXp: REFERRAL_CONFIG.signupBonusRefereeXp,
            minPayoutUsd: REFERRAL_CONFIG.minPayoutUsd,
            milestones: REFERRAL_CONFIG.milestones,
            affiliateTiers: REFERRAL_CONFIG.affiliateTiers,
        });
    }

    if (action === "leaderboard") {
        const leaders = await adminGetTopReferrers(15);
        return NextResponse.json({ leaders });
    }

    if (!wallet) {
        return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }

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
        const stats = await adminGetReferralStats(wallet);
        return NextResponse.json(stats);
    }

    if (action === "payout") {
        // Manual claim / force auto-payout attempt for this wallet
        const result = await tryAutoPayout(wallet);
        return NextResponse.json(result, {
            status: result.success ? 200 : result.skipped ? 200 : 400,
        });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/** Public config for unauthenticated marketing surfaces */
export async function GET() {
    return NextResponse.json({
        headline: REFERRAL_CONFIG.headline,
        subhead: REFERRAL_CONFIG.subhead,
        feeShare: "50–65%",
        l2Share: "10%",
        refereeCashback: "15%",
        refereeXpBoost: "1.5×",
        signupXp: {
            referrer: REFERRAL_CONFIG.signupBonusReferrerXp,
            referee: REFERRAL_CONFIG.signupBonusRefereeXp,
        },
        exampleCode: generateReferralCode("ExampleWallet1111111111111111111111111"),
    });
}
