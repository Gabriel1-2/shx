"use client";

import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

export function useSolanaTPS() {
    const { connection } = useConnection();
    const [tps, setTps] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTPS = async () => {
            try {
                // Get recent performance samples from the RPC
                const samples = await connection.getRecentPerformanceSamples(1);
                if (samples.length > 0) {
                    const sample = samples[0];
                    // TPS = transactions / seconds in sample period
                    const calculatedTps = sample.numTransactions / sample.samplePeriodSecs;
                    setTps(Math.round(calculatedTps));
                }
            } catch (err) {
                console.error("Failed to fetch TPS:", err);
                // Fallback: try public API
                try {
                    const res = await fetch("https://api.mainnet-beta.solana.com", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            jsonrpc: "2.0",
                            id: 1,
                            method: "getRecentPerformanceSamples",
                            params: [1]
                        })
                    });
                    const data = await res.json();
                    if (data.result && data.result.length > 0) {
                        const sample = data.result[0];
                        setTps(Math.round(sample.numTransactions / sample.samplePeriodSecs));
                    }
                } catch (fallbackErr) {
                    console.error("Fallback TPS fetch failed:", fallbackErr);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchTPS();
        // Refresh every 10 seconds
        const interval = setInterval(fetchTPS, 10000);
        return () => clearInterval(interval);
    }, [connection]);

    return { tps, loading };
}
