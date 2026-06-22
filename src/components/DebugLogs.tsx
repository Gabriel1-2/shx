"use client";

import { useState, useEffect } from "react";
import { Terminal, X, Trash2, Bug } from "lucide-react";

interface LogEntry {
    timestamp: number;
    level: "error" | "warn" | "info";
    message: string;
    details?: any;
}

export const useDebugLogs = () => {
    // We use a global array so all components log to the same place without context
    const addLog = (level: "error" | "warn" | "info", message: string, details?: any) => {
        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            details: details ? JSON.parse(JSON.stringify(details, Object.getOwnPropertyNames(details))) : undefined
        };
        
        try {
            const existing = JSON.parse(localStorage.getItem("shx_debug_logs") || "[]");
            const updated = [entry, ...existing].slice(0, 100); // Keep last 100
            localStorage.setItem("shx_debug_logs", JSON.stringify(updated));
            // Dispatch event for UI
            window.dispatchEvent(new Event('shx_new_log'));
        } catch (e) {
            console.warn("Failed to save debug log", e);
        }
    };

    return { addLog };
};

export default function DebugLogsViewer() {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const loadLogs = () => {
        try {
            setLogs(JSON.parse(localStorage.getItem("shx_debug_logs") || "[]"));
        } catch (e) {
            setLogs([]);
        }
    };

    useEffect(() => {
        loadLogs();
        window.addEventListener('shx_new_log', loadLogs);
        return () => window.removeEventListener('shx_new_log', loadLogs);
    }, []);

    const clearLogs = () => {
        localStorage.removeItem("shx_debug_logs");
        setLogs([]);
    };

    // Keyboard shortcut to open (Ctrl+Shift+L)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
                setIsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-[999999] p-2 rounded-full bg-black/50 border border-white/10 text-white/30 hover:text-white/80 hover:bg-black/80 backdrop-blur-md transition-all shadow-lg"
                title="Open Developer Logs"
            >
                <Bug size={16} />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[999999] flex flex-col justify-end sm:items-center sm:justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
            <div className="bg-[#111] border-t sm:border border-white/10 sm:rounded-xl w-full h-[80vh] sm:h-[80vh] max-w-4xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
                    <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-blue-400" />
                        <h2 className="text-sm font-bold text-white tracking-wide">Developer Logs</h2>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white/70">{logs.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={clearLogs} className="p-1.5 text-white/50 hover:text-red-400 transition-colors" title="Clear Logs">
                            <Trash2 size={16} />
                        </button>
                        <button onClick={() => setIsOpen(false)} className="p-1.5 text-white/50 hover:text-white transition-colors" title="Close">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] sm:text-xs">
                    {logs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-white/30">
                            No logs recorded yet.
                        </div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className={`p-3 rounded-lg border ${
                                log.level === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                log.level === 'warn' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                'bg-white/5 border-white/10 text-white/80'
                            }`}>
                                <div className="flex items-center gap-3 mb-1.5 opacity-60">
                                    <span className="uppercase font-bold text-[10px] tracking-wider">{log.level}</span>
                                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 })}</span>
                                </div>
                                <div className="font-semibold whitespace-pre-wrap leading-relaxed">{log.message}</div>
                                {log.details && (
                                    <div className="mt-2 pt-2 border-t border-current/10 opacity-80 whitespace-pre-wrap break-all overflow-x-auto">
                                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
                
                {/* Footer instructions */}
                <div className="px-4 py-2 border-t border-white/10 bg-black/40 text-[10px] text-white/40 text-center">
                    Press <kbd className="bg-white/10 px-1 py-0.5 rounded">Ctrl</kbd> + <kbd className="bg-white/10 px-1 py-0.5 rounded">Shift</kbd> + <kbd className="bg-white/10 px-1 py-0.5 rounded">L</kbd> to toggle this window.
                </div>
            </div>
        </div>
    );
}
