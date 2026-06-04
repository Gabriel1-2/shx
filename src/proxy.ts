import { NextRequest, NextResponse } from 'next/server';

// Comprehensive OFAC sanctioned country list
const SANCTIONED_COUNTRIES = [
    'CU', // Cuba
    'IR', // Iran
    'KP', // North Korea
    'SY', // Syria
    // Additional high-risk/sanctioned regions often blocked:
    'BY', // Belarus
    'RU', // Russia
    'VE', // Venezuela
];

export function middleware(req: NextRequest) {
    // In Vercel, the country code is available in the headers 'x-vercel-ip-country'
    const country = req.headers.get('x-vercel-ip-country');

    // Always allow access to the unsupported page itself to prevent redirect loops
    if (req.nextUrl.pathname.startsWith('/unsupported')) {
        return NextResponse.next();
    }

    if (country && SANCTIONED_COUNTRIES.includes(country)) {
        console.warn(`[Compliance] Blocked request from sanctioned country: ${country}`);
        
        // Redirect the user to the unsupported region page
        const url = req.nextUrl.clone();
        url.pathname = '/unsupported';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    // Only run middleware on paths that require compliance
    // We don't need to block purely informational static assets
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes can have their own compliance, but blocking frontend is primary)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
