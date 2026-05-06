import { NextRequest, NextResponse } from "next/server";

const SHX_MINT = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=e36d269b-1bf1-4c2a-9efd-47d319ca4882";

// ─── Symbol → Mint resolver ──────────────────────────────────
const SYMBOL_MAP: Record<string, { mint: string; decimals: number; name: string }> = {
    "SOL":  { mint: "So11111111111111111111111111111111111111112", decimals: 9, name: "Solana" },
    "USDC": { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, name: "USD Coin" },
    "USDT": { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, name: "Tether" },
    "SHX":  { mint: "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q", decimals: 9, name: "Shulevitz" },
    "BONK": { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, name: "Bonk" },
    "WIF":  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, name: "dogwifhat" },
    "JUP":  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, name: "Jupiter" },
    "RAY":  { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, name: "Raydium" },
    "ORCA": { mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6, name: "Orca" },
    "PYTH": { mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, name: "Pyth Network" },
};

const FEE_TIERS = [
    { minSHX: 500_000, feeBps: 50, feePercent: 0.50, label: "Diamond" },
    { minSHX: 100_000, feeBps: 52, feePercent: 0.52, label: "Platinum" },
    { minSHX: 50_000,  feeBps: 55, feePercent: 0.55, label: "Gold" },
    { minSHX: 10_000,  feeBps: 60, feePercent: 0.60, label: "Silver" },
    { minSHX: 0,       feeBps: 65, feePercent: 0.65, label: "Base" },
];

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        "X-Powered-By": "SHX Exchange Agent API",
    };
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/agent/connect?wallet=<WALLET_ADDRESS>
 *
 * One-call agent onboarding. Returns everything an agent needs to start trading:
 *   - Wallet validation
 *   - SOL balance (for gas)
 *   - SHX balance & fee tier
 *   - All token balances
 *   - Ready-to-use configuration
 *   - Symbol resolver map
 */
export async function GET(req: NextRequest) {
    const wallet = new URL(req.url).searchParams.get("wallet");

    if (!wallet) {
        return NextResponse.json({
            error: "Missing 'wallet' query parameter",
            example: "/api/agent/connect?wallet=YOUR_SOLANA_WALLET_ADDRESS",
            hint: "Pass any valid Solana public key. No registration or API key required.",
        }, { status: 400, headers: corsHeaders() });
    }

    // Validate wallet format (basic check)
    if (wallet.length < 32 || wallet.length > 44) {
        return NextResponse.json({
            error: "Invalid wallet address format",
            hint: "Must be a valid Solana base58 public key (32-44 characters)",
        }, { status: 400, headers: corsHeaders() });
    }

    try {
        // 1. Get SOL balance
        const solBalanceRes = await fetch(HELIUS_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0", id: 1,
                method: "getBalance",
                params: [wallet],
            }),
        });
        const solData = await solBalanceRes.json();
        const solBalance = (solData.result?.value || 0) / 1e9;

        // 2. Get all token balances
        const tokenRes = await fetch(HELIUS_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0", id: 2,
                method: "getTokenAccountsByOwner",
                params: [
                    wallet,
                    { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                    { encoding: "jsonParsed" },
                ],
            }),
        });
        const tokenData = await tokenRes.json();

        // Parse token balances
        const tokenBalances: Record<string, { balance: number; mint: string }> = {};
        let shxBalance = 0;

        if (tokenData.result?.value) {
            for (const account of tokenData.result.value) {
                const info = account.account.data.parsed.info;
                const mint = info.mint;
                const balance = info.tokenAmount.uiAmount || 0;

                if (balance > 0) {
                    // Find symbol for this mint
                    const symbolEntry = Object.entries(SYMBOL_MAP).find(([_, v]) => v.mint === mint);
                    if (symbolEntry) {
                        tokenBalances[symbolEntry[0]] = { balance, mint };
                    }
                    if (mint === SHX_MINT) {
                        shxBalance = balance;
                    }
                }
            }
        }

        // 3. Determine fee tier
        let currentTier = FEE_TIERS[FEE_TIERS.length - 1];
        for (const tier of FEE_TIERS) {
            if (shxBalance >= tier.minSHX) {
                currentTier = tier;
                break;
            }
        }

        // 4. Gas check
        const hasGas = solBalance > 0.01;

        return NextResponse.json({
            status: "connected",
            wallet,

            // Balances
            solBalance,
            shxBalance,
            hasGas,
            gasWarning: hasGas ? null : "Low SOL balance. You need at least 0.01 SOL for transaction fees.",
            tokenBalances,

            // Fee tier
            feeTier: {
                label: currentTier.label,
                feeBps: currentTier.feeBps,
                feePercent: currentTier.feePercent,
            },

            // Ready-to-use config for /quote calls
            config: {
                quoteEndpoint: "/api/agent/quote",
                swapEndpoint: "/api/agent/swap",
                taker: wallet,
                referralAccount: "9rvZ5CC86oFWgwej21DMPR83LSMBoDehrNe6v6V7AAeg",
            },

            // Symbol resolver — agents can use symbols instead of mints
            symbolMap: SYMBOL_MAP,

            // Instructions
            _quickstart: {
                step1: `GET /api/agent/quote?inputMint=${SYMBOL_MAP.SOL.mint}&outputMint=${SYMBOL_MAP.USDC.mint}&amount=1000000000&taker=${wallet}`,
                step2: "Deserialize response.transaction (base64), sign with your wallet keypair",
                step3: "POST /api/agent/swap with { signedTransaction, requestId }",
                note: "That's it. 3 calls to swap any token. No API keys. No registration.",
            },
        }, { headers: corsHeaders() });

    } catch (err: any) {
        return NextResponse.json({
            error: "Failed to connect wallet",
            message: err.message,
        }, { status: 500, headers: corsHeaders() });
    }
}
