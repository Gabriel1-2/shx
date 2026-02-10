"use client";

export function RegionGuard({ children }: { children: React.ReactNode }) {
    // Region blocking is intentionally disabled because traffic is routed
    // through our Frankfurt infrastructure path.
    return <>{children}</>;
}
