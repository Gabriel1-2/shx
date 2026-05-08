"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
    useEffect(() => {
        if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
            navigator.serviceWorker
                .register("/sw.js")
                .then((reg) => {
                    console.log("[PWA] Service Worker registered:", reg.scope);
                })
                .catch((err) => {
                    console.warn("[PWA] Service Worker registration failed:", err);
                });
        }
    }, []);

    return null;
}
