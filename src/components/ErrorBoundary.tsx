"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[400px] w-full flex flex-col items-center justify-center p-6 bg-black/40 border border-red-500/20 rounded-2xl backdrop-blur-md">
                    <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Service Degraded</h2>
                    <p className="text-muted-foreground text-center mb-6 max-w-md">
                        We encountered an unexpected error loading this module. Our team has been notified.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-colors"
                    >
                        <RefreshCcw size={16} />
                        Try Again
                    </button>
                    {process.env.NODE_ENV === "development" && this.state.error && (
                        <div className="mt-8 p-4 bg-black/80 rounded-lg max-w-full overflow-auto text-left text-red-400 text-xs font-mono">
                            {this.state.error.message}
                            <br />
                            {this.state.error.stack}
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
