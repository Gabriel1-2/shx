"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Globe } from "lucide-react";

export function RegionGuard({ children }: { children: React.ReactNode }) {
    const [isRestricted, setIsRestricted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkRegion = async () => {
            try {
                // Free IP Geolocation API
                const response = await fetch("https://ipapi.co/json/");
                const data = await response.json();

                // List of restricted countries (matching Jupiter's list + US)
                const restrictedCountries = ["US", "GB", "CN", "CU", "IR", "KP", "SY", "MM"];

                if (restrictedCountries.includes(data.country_code)) {
                    setIsRestricted(true);
                }
            } catch (error) {
                console.warn("[REGION GUARD] Failed to check region, allowing access.");
            } finally {
                setIsLoading(false);
            }
        };

        checkRegion();
    }, []);

    if (isRestricted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
                <div className="max-w-md w-full bg-[#0a0a0a] border border-red-500/30 rounded-2xl p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                        <ShieldAlert className="h-10 w-10 text-red-500" />
                    </div>

                    <h2 className="mb-2 text-2xl font-bold text-white">Access Restricted</h2>
                    <p className="mb-6 text-muted-foreground">
                        Your connection appears to be from a restricted region (United States/UK).
                        This decentralized interface cannot be accessed from your location due to compliance regulations.
                    </p>

                    <div className="rounded-xl bg-white/5 p-4 text-left border border-white/10 mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Globe className="text-primary" size={18} />
                            <span className="font-bold text-white text-sm">Recommended Action</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Please ensure you are using a secure, unrestricted connection (VPN) to access decentralized protocols.
                            Reload this page once your connection is secured.
                        </p>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="w-full rounded-xl bg-primary py-3 font-bold text-black hover:bg-primary/90 transition-colors"
                    >
                        I have secured my connection ↻
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
