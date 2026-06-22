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
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4">
                    <div className="bg-[#111] border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl relative overflow-hidden">
                        <button 
                            onClick={() => setShowIosInstructions(false)}
                            className="absolute right-4 top-4 text-white/50 hover:text-white bg-white/5 rounded-full p-1 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-4 mt-2">
                            <div className="p-2 rounded-xl bg-green-500/20 text-green-500">
                                <Download className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight">Install SHX</h3>
                        </div>
                        
                        <p className="text-white/70 text-sm mb-6 leading-relaxed">
                            Apple strictly requires iOS users to install apps manually. Follow these quick steps:
                        </p>
                        
                        <div className="space-y-3 mb-8">
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-500 font-bold text-xs shrink-0">1</div>
                                <div className="text-white/90 text-sm">Tap the <Share className="inline w-4 h-4 mx-1 text-blue-400" /> <span className="font-bold text-white">Share</span> button below</div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-500 font-bold text-xs shrink-0">2</div>
                                <div className="text-white/90 text-sm">Scroll down and tap <span className="font-bold text-white">Add to Home Screen</span></div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-500 font-bold text-xs shrink-0">3</div>
                                <div className="text-white/90 text-sm">Tap <span className="font-bold text-white">Add</span> in the top right</div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setShowIosInstructions(false)}
                            className="w-full py-3.5 bg-green-500 text-black rounded-xl font-bold hover:bg-green-400 transition-colors text-base"
                        >
                            I understand
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
