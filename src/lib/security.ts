import { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://shx.exchange",
    "https://www.shx.exchange"
];

/**
 * Validates the Origin and Referer headers to prevent CSRF attacks.
 * Internal API routes (that modify state) should call this.
 */
export function validateInternalOrigin(req: NextRequest): { success: boolean; error?: string } {
    // In development or when explicitly skipping origin checks
    if (process.env.NODE_ENV === "development" && process.env.SKIP_ORIGIN_CHECK === "true") {
        return { success: true };
    }

    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");

    // Same-origin navigations / some GETs may omit Origin; require Origin or Referer.
    // In production on Vercel, also allow requests that only carry the host header
    // when both are missing only in development for local tooling.
    if (!origin && !referer) {
        if (process.env.NODE_ENV === "development") {
            return { success: true };
        }
        return { success: false, error: "Missing Origin and Referer headers" };
    }

    // Check Origin
    if (origin) {
        const isAllowed = ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed) || origin.endsWith(".vercel.app"));
        if (!isAllowed) {
            console.warn(`[Security] Blocked CSRF attempt from untrusted origin: ${origin}`);
            return { success: false, error: "Untrusted Origin" };
        }
    }

    // Check Referer
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            const isAllowed = ALLOWED_ORIGINS.some(allowed => refererUrl.origin.startsWith(allowed) || refererUrl.origin.endsWith(".vercel.app"));
            if (!isAllowed) {
                console.warn(`[Security] Blocked CSRF attempt from untrusted referer: ${refererUrl.origin}`);
                return { success: false, error: "Untrusted Referer" };
            }
        } catch (e) {
            return { success: false, error: "Malformed Referer" };
        }
    }

    return { success: true };
}
