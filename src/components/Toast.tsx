"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { CheckCircle, XCircle, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Toast {
    id: string;
    type: "success" | "error" | "info";
    title: string;
    message?: string;
    txId?: string;
}

interface ToastContextType {
    showToast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within ToastProvider");
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (toast: Omit<Toast, "id">) => {
        const id = Math.random().toString(36).substring(7);
        setToasts((prev) => [...prev, { ...toast, id }]);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    };

    const dismissToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100 }}
                            className={`rounded-xl border p-4 shadow-2xl backdrop-blur-xl ${toast.type === "success"
                                    ? "bg-green-500/10 border-green-500/30"
                                    : toast.type === "error"
                                        ? "bg-red-500/10 border-red-500/30"
                                        : "bg-white/5 border-white/10"
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {toast.type === "success" ? (
                                    <CheckCircle className="text-green-400 shrink-0" size={20} />
                                ) : toast.type === "error" ? (
                                    <XCircle className="text-red-400 shrink-0" size={20} />
                                ) : null}

                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-white text-sm">{toast.title}</div>
                                    {toast.message && (
                                        <div className="text-xs text-muted-foreground mt-1">{toast.message}</div>
                                    )}
                                    {toast.txId && (
                                        <a
                                            href={`https://solscan.io/tx/${toast.txId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                                        >
                                            View on Solscan
                                            <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>

                                <button
                                    onClick={() => dismissToast(toast.id)}
                                    className="p-1 hover:bg-white/10 rounded-full shrink-0"
                                >
                                    <X size={14} className="text-muted-foreground" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}
