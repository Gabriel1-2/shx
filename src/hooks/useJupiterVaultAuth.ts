"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

const JWT_KEY = "shx_jupiter_jwt";
const JWT_WALLET_KEY = "shx_jupiter_jwt_wallet";

/**
 * Jupiter Trigger V2 vault auth (challenge → sign → JWT → register vault).
 * JWT is stored for BackgroundSyncer / OrdersPanel (24h TTL).
 */
export function useJupiterVaultAuth() {
    const { publicKey, signMessage } = useWallet();
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const getStoredJwt = useCallback((): string | null => {
        if (typeof window === "undefined" || !publicKey) return null;
        try {
            const wallet = publicKey.toString();
            const storedWallet = localStorage.getItem(JWT_WALLET_KEY);
            if (storedWallet && storedWallet !== wallet) {
                localStorage.removeItem(JWT_KEY);
                localStorage.removeItem(JWT_WALLET_KEY);
                return null;
            }
            return localStorage.getItem(JWT_KEY);
        } catch {
            return null;
        }
    }, [publicKey]);

    const storeJwt = useCallback(
        (token: string) => {
            if (!publicKey) return;
            try {
                localStorage.setItem(JWT_KEY, token);
                localStorage.setItem(JWT_WALLET_KEY, publicKey.toString());
            } catch {
                /* ignore */
            }
        },
        [publicKey]
    );

    const authenticate = useCallback(async (): Promise<string> => {
        if (!publicKey || !signMessage) {
            throw new Error("Wallet does not support message signing (required for limit orders).");
        }

        setIsAuthenticating(true);
        try {
            const wallet = publicKey.toString();

            const challengeRes = await fetch("/api/limit/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "request-challenge", wallet }),
            });
            const challengeData = await challengeRes.json();
            if (!challengeRes.ok) {
                throw new Error(challengeData.error || "Failed to get auth challenge");
            }

            const encodedMessage = new TextEncoder().encode(challengeData.challenge);
            const signature = await signMessage(encodedMessage);
            const base58Sig = bs58.encode(signature);

            const verifyRes = await fetch("/api/limit/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "verify-challenge",
                    wallet,
                    signature: base58Sig,
                }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
                throw new Error(verifyData.error || "Failed to verify signature");
            }

            const jwt = verifyData.token as string;
            if (!jwt) throw new Error("No JWT returned from verify");

            storeJwt(jwt);

            // Ensure vault exists
            const vaultGet = await fetch("/api/limit/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "get-vault", jwt }),
            });
            if (!vaultGet.ok) {
                const regRes = await fetch("/api/limit/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "register-vault", jwt }),
                });
                if (!regRes.ok) {
                    const regData = await regRes.json();
                    throw new Error(regData.error || "Failed to register vault");
                }
            }

            return jwt;
        } finally {
            setIsAuthenticating(false);
        }
    }, [publicKey, signMessage, storeJwt]);

    /** Return stored JWT or run full auth */
    const ensureAuth = useCallback(async (): Promise<string> => {
        const existing = getStoredJwt();
        if (existing) {
            // Verify vault still reachable; if 401, re-auth
            const vaultRes = await fetch("/api/limit/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "get-vault", jwt: existing }),
            });
            if (vaultRes.ok || vaultRes.status === 404 || vaultRes.status === 400) {
                // 404 → try register with same JWT
                if (!vaultRes.ok) {
                    await fetch("/api/limit/create", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "register-vault", jwt: existing }),
                    });
                }
                return existing;
            }
        }
        return authenticate();
    }, [getStoredJwt, authenticate]);

    return {
        authenticate,
        ensureAuth,
        getStoredJwt,
        isAuthenticating,
    };
}
