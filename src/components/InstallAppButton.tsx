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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
                        <button 
                            onClick={() => setShowIosInstructions(false)}
                            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-lg font-semibold mb-2">Install SHX Exchange</h3>
                        <p className="text-muted-foreground text-sm mb-6">
                            To install this app on your iOS device for the best experience:
                        </p>
                        <ol className="space-y-4 text-sm">
                            <li className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 min-w-[2rem] rounded-full bg-primary/10 text-primary font-bold">1</span>
                                <span>Tap the <Share className="inline w-4 h-4 mx-1" /> Share button in your browser toolbar</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 min-w-[2rem] rounded-full bg-primary/10 text-primary font-bold">2</span>
                                <span>Scroll down and select <strong>"Add to Home Screen"</strong></span>
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 min-w-[2rem] rounded-full bg-primary/10 text-primary font-bold">3</span>
                                <span>Tap <strong>Add</strong> in the top right</span>
                            </li>
                        </ol>
                        <button 
                            onClick={() => setShowIosInstructions(false)}
                            className="mt-8 w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
