import { NextRequest } from "next/server";

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

export function rateLimit(
    req: NextRequest,
    limit: number = 20, // max requests
    windowMs: number = 60 * 1000 // 1 minute
): { success: boolean; limit: number; remaining: number; reset: number } {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    const now = Date.now();
    const windowStart = now - (now % windowMs);

    const record = rateLimitMap.get(ip);

    if (!record || record.lastReset < windowStart) {
        rateLimitMap.set(ip, { count: 1, lastReset: windowStart });
        return { success: true, limit, remaining: limit - 1, reset: windowStart + windowMs };
    }

    if (record.count >= limit) {
        return { success: false, limit, remaining: 0, reset: windowStart + windowMs };
    }

    record.count += 1;
    rateLimitMap.set(ip, record);

    return { success: true, limit, remaining: limit - record.count, reset: windowStart + windowMs };
}
