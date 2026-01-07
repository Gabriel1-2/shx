"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

// CRITICAL: Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaProvider({ children }: { children: React.ReactNode }) {
    const network = WalletAdapterNetwork.Mainnet;
    // Using Helius Premium RPC for reliable, fast connections
    const endpoint = useMemo(() => "https://mainnet.helius-rpc.com/?api-key=e36d269b-1bf1-4c2a-9efd-47d319ca4882", []);

    // Include common wallet adapters
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}
