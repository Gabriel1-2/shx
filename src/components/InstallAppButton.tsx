"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

export function InstallAppButton() {
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [showIosInstructions, setShowIosInstructions] = useState(false);

    useEffect(() => {
        const checkInstalled = () => {
            if (typeof window !== 'undefined') {
                if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
                    setIsInstalled(true);
                }
                
                const userAgent = window.navigator.userAgent.toLowerCase();
                if (/iphone|ipad|ipod/.test(userAgent)) {
                    setIsIos(true);
                }
            }
        };
        checkInstalled();

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", () => {
            setInstallPrompt(null);
            setIsInstalled(true);
        });

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isIos && !installPrompt) {
            setShowIosInstructions(true);
            return;
        }
        if (!installPrompt) return;
        
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setInstallPrompt(null);
        }
    };

    if (isInstalled || (!installPrompt && !isIos)) {
        return null; 
    }

    return (
        <>
            <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary border border-primary/20 rounded-full hover:bg-primary/20 transition-colors"
            >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Install App</span>
            </button>

            {showIosInstructions && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 pb-0">
                    <div className="bg-[#111] border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm shadow-2xl relative max-h-[90vh] overflow-y-auto pb-safe">
                        <button 
                            onClick={() => setShowIosInstructions(false)}
                            className="absolute right-4 top-4 text-muted-foreground hover:text-white bg-black/50 rounded-full p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-primary/20 text-primary">
                                <Download className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Install on iOS</h3>
                        </div>
                        <p className="text-muted-foreground text-sm mb-5">
                            Apple strictly requires iOS users to install apps manually. Follow these steps:
                        </p>
                        <ol className="space-y-4 text-sm mb-6">
                            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs">1</span>
                                <span className="text-white">Tap the <Share className="inline w-4 h-4 mx-1 text-blue-400" /> <span className="font-bold">Share</span> button below</span>
                            </li>
                            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs">2</span>
                                <span className="text-white">Scroll down and tap <span className="font-bold">Add to Home Screen</span></span>
                            </li>
                            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs">3</span>
                                <span className="text-white">Tap <span className="font-bold">Add</span> in the top right</span>
                            </li>
                        </ol>
                        <button 
                            onClick={() => setShowIosInstructions(false)}
                            className="w-full py-3 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-colors"
                        >
                            I understand
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
