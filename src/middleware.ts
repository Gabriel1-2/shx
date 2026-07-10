import { NextRequest, NextResponse } from "next/server";

/** OFAC / high-risk country blocks for the web UI (API has its own compliance). */
const SANCTIONED_COUNTRIES = ["CU", "IR", "KP", "SY", "BY", "RU", "VE"];

export function middleware(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith("/unsupported")) {
        return NextResponse.next();
    }

    const country = req.headers.get("x-vercel-ip-country");
    if (country && SANCTIONED_COUNTRIES.includes(country)) {
        console.warn(`[Compliance] Blocked request from sanctioned country: ${country}`);
        const url = req.nextUrl.clone();
        url.pathname = "/unsupported";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox).*)"],
};
