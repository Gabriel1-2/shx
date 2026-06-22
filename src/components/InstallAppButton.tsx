"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X, Share } from "lucide-react";

export function InstallAppButton() {
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [showIosInstructions, setShowIosInstructions] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
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

            {mounted && showIosInstructions && createPortal(
                <div className="fixed inset-0 z-[99999] flex flex-col justify-end bg-black/90 sm:items-center sm:justify-center sm:p-4">
                    <div className="bg-[#111] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-sm shadow-2xl relative max-h-[85vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom-8">
                        <button 
                            onClick={() => setShowIosInstructions(false)}
                            className="absolute right-5 top-5 text-white/50 hover:text-white bg-white/5 rounded-full p-1.5 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-5 mt-1">
                            <div className="p-2.5 rounded-xl bg-green-500/20 text-green-500">
                                <Download className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight">Install SHX</h3>
                        </div>
                        
                        <p className="text-white/70 text-sm mb-6 leading-relaxed pr-8">
                            Apple requires iOS users to install apps manually. Follow these quick steps:
                        </p>
                        
                        <div className="space-y-3 mb-8">
                            <div className="flex items-center gap-3 bg-white/5 p-3.5 rounded-xl border border-white/5">
                                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-500/20 text-green-500 font-bold text-sm shrink-0">1</div>
                                <div className="text-white/90 text-sm">Tap the <Share className="inline w-5 h-5 mx-1 text-blue-400" /> <span className="font-bold text-white">Share</span> button below</div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-3.5 rounded-xl border border-white/5">
                                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-500/20 text-green-500 font-bold text-sm shrink-0">2</div>
                                <div className="text-white/90 text-sm">Scroll down and tap <span className="font-bold text-white">Add to Home Screen</span></div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-3.5 rounded-xl border border-white/5">
                                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-500/20 text-green-500 font-bold text-sm shrink-0">3</div>
                                <div className="text-white/90 text-sm">Tap <span className="font-bold text-white">Add</span> in the top right</div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setShowIosInstructions(false)}
                            className="w-full py-4 bg-green-500 text-black rounded-xl font-bold hover:bg-green-400 transition-colors text-base"
                        >
                            I understand
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
