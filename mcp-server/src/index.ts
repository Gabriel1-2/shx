/**
 * SHX Exchange MCP Server
 *
 * Local stdio MCP for Claude Desktop / Cursor / agent hosts.
 * Wraps https://shx.exchange/api/agent/* with safety rails and optional
 * local signing (WALLET_PRIVATE_KEY never leaves this process).
 *
 * Read-only tools work without a key. Execute requires a local keypair.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { VersionedTransaction, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import * as dotenv from "dotenv";

dotenv.config();

const SHX_API_URL = (process.env.SHX_API_URL || "https://shx.exchange").replace(/\/$/, "");
const MAX_SWAP_LAMPORTS = BigInt(process.env.SHX_MAX_SWAP_LAMPORTS || "5000000000"); // 5 SOL default
const ALLOW_EXECUTE = process.env.SHX_ALLOW_EXECUTE !== "0";

const SHX_MINT = "336xqC8BDQ4MBKyDBye2qtMhRvDKu3ccr5R5bnMbaU4Q";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

let wallet: Keypair | null = null;
if (process.env.WALLET_PRIVATE_KEY) {
  try {
    wallet = Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY));
  } catch {
    console.error(
      "[shx-mcp] Failed to load WALLET_PRIVATE_KEY — read-only mode."
    );
  }
}

function jsonText(data: unknown, isError = false) {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function apiGet(path: string) {
  const res = await fetch(`${SHX_API_URL}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "shx-mcp/2.0" },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} ${path}: ${typeof data === "object" ? JSON.stringify(data) : text}`
    );
  }
  return data;
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${SHX_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "shx-mcp/2.0",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} ${path}: ${typeof data === "object" ? JSON.stringify(data) : text}`
    );
  }
  return data;
}

const TOOLS = [
  {
    name: "shx_health",
    description:
      "SHX Exchange agent API health, fee tiers, endpoints, and Jupiter Ultra status. Call first.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "shx_connect",
    description:
      "Onboard a wallet: SOL/SHX balances, fee tier, gas check, symbol map, quote config. No API key.",
    inputSchema: {
      type: "object",
      properties: {
        wallet: {
          type: "string",
          description: "Solana pubkey. Defaults to local MCP wallet if set.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "shx_resolve",
    description:
      "Resolve token symbols (SOL, USDC, SHX, BONK, …) to mint addresses and decimals.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "One symbol or comma-separated list, e.g. SOL,USDC,SHX",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "shx_tokens",
    description: "List default watchlist tokens with live prices (optional mint filter).",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Optional mint to look up" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "shx_check_tier",
    description: "Fee tier for a wallet from SHX balance (Base→Diamond, 0.65%→0.50%).",
    inputSchema: {
      type: "object",
      properties: {
        wallet: {
          type: "string",
          description: "Solana pubkey. Defaults to local MCP wallet if set.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "shx_live_stats",
    description:
      "Public live platform proof: unique traders, volume, fees, recent activity.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "shx_referral_link",
    description:
      "Build a shareable SHX referral / deep-link URL for a wallet or code.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Referral code if known" },
        wallet: { type: "string", description: "Wallet to attach as ref param" },
        mint: { type: "string", description: "Optional output mint for trade deep-link" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "shx_get_quote",
    description:
      "Get Jupiter Ultra swap quote + unsigned tx via SHX (auto fee tier / 0% on SHX buys). Does NOT sign. Prefer dryRun=true first.",
    inputSchema: {
      type: "object",
      properties: {
        inputMint: { type: "string", description: "Mint to sell" },
        outputMint: { type: "string", description: "Mint to buy" },
        amount: {
          type: "string",
          description: "Raw amount in smallest units (lamports for SOL)",
        },
        taker: {
          type: "string",
          description: "Taker wallet. Defaults to local MCP wallet.",
        },
        dryRun: {
          type: "boolean",
          description: "If true, still returns quote but flags not to execute (default false)",
        },
      },
      required: ["inputMint", "outputMint", "amount"],
      additionalProperties: false,
    },
  },
  {
    name: "shx_swap_intent",
    description:
      "High-level quote by symbols: e.g. sell 0.1 SOL for SHX. Resolves symbols, builds raw amount, returns quote. Prefer before execute.",
    inputSchema: {
      type: "object",
      properties: {
        sellSymbol: { type: "string", description: "e.g. SOL" },
        buySymbol: { type: "string", description: "e.g. SHX or USDC" },
        amountUi: {
          type: "number",
          description: "Human amount of sell token (e.g. 0.1 SOL)",
        },
        taker: { type: "string" },
        dryRun: { type: "boolean" },
      },
      required: ["sellSymbol", "buySymbol", "amountUi"],
      additionalProperties: false,
    },
  },
  {
    name: "shx_execute_swap",
    description:
      "Sign unsigned tx with LOCAL WALLET_PRIVATE_KEY and submit to SHX / Jupiter Ultra. Requires confirm=true. Key never leaves this process.",
    inputSchema: {
      type: "object",
      properties: {
        transaction: {
          type: "string",
          description: "Base64 unsigned transaction from shx_get_quote",
        },
        requestId: { type: "string", description: "requestId from quote" },
        confirm: {
          type: "boolean",
          description: "Must be true to execute (safety latch)",
        },
      },
      required: ["transaction", "requestId", "confirm"],
      additionalProperties: false,
    },
  },
];

const server = new Server(
  { name: "shx-exchange", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments || {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "shx_health": {
        const data = await apiGet("/api/agent/health");
        return jsonText({
          ...(data as object),
          mcp: {
            version: "2.0.0",
            mode: wallet ? "sign-enabled" : "read-only",
            localWallet: wallet?.publicKey.toBase58() ?? null,
            apiBase: SHX_API_URL,
            maxSwapLamports: MAX_SWAP_LAMPORTS.toString(),
            executeEnabled: ALLOW_EXECUTE && !!wallet,
          },
        });
      }

      case "shx_connect": {
        const w =
          (args.wallet as string) || wallet?.publicKey.toBase58() || null;
        if (!w) {
          return jsonText(
            {
              error: "wallet required",
              hint: "Pass wallet= or set WALLET_PRIVATE_KEY in mcp-server .env",
            },
            true
          );
        }
        return jsonText(await apiGet(`/api/agent/connect?wallet=${encodeURIComponent(w)}`));
      }

      case "shx_resolve": {
        const symbol = args.symbol as string | undefined;
        const q = symbol
          ? `?symbol=${encodeURIComponent(symbol)}`
          : "";
        return jsonText(await apiGet(`/api/agent/resolve${q}`));
      }

      case "shx_tokens": {
        const mint = args.mint as string | undefined;
        const q = mint ? `?mint=${encodeURIComponent(mint)}` : "";
        return jsonText(await apiGet(`/api/agent/tokens${q}`));
      }

      case "shx_check_tier": {
        const w =
          (args.wallet as string) || wallet?.publicKey.toBase58() || null;
        if (!w) {
          return jsonText({ error: "wallet required" }, true);
        }
        return jsonText(await apiGet(`/api/agent/tier?wallet=${encodeURIComponent(w)}`));
      }

      case "shx_live_stats": {
        return jsonText(await apiGet("/api/stats/live"));
      }

      case "shx_referral_link": {
        const code = (args.code as string) || "";
        const w = (args.wallet as string) || wallet?.publicKey.toBase58() || "";
        const mint = (args.mint as string) || "";
        const u = new URL(`${SHX_API_URL}/`);
        if (code) u.searchParams.set("ref", code);
        else if (w) u.searchParams.set("ref", w);
        if (mint) {
          u.pathname = "/pro";
          u.searchParams.set("mint", mint);
        }
        return jsonText({
          url: u.toString(),
          referralsPage: `${SHX_API_URL}/referrals`,
          note: "Share this link. Qualified volume gates apply before fee share.",
        });
      }

      case "shx_get_quote": {
        const inputMint = String(args.inputMint || "");
        const outputMint = String(args.outputMint || "");
        const amount = String(args.amount || "");
        const taker =
          (args.taker as string) || wallet?.publicKey.toBase58() || "";
        const dryRun = Boolean(args.dryRun);

        if (!inputMint || !outputMint || !amount || !taker) {
          return jsonText(
            {
              error: "inputMint, outputMint, amount, and taker (or local wallet) required",
            },
            true
          );
        }

        // Safety: cap SOL-sized raw amounts when selling SOL
        try {
          const raw = BigInt(amount);
          if (inputMint === SOL_MINT && raw > MAX_SWAP_LAMPORTS) {
            return jsonText(
              {
                error: "amount exceeds SHX_MAX_SWAP_LAMPORTS safety cap",
                maxLamports: MAX_SWAP_LAMPORTS.toString(),
                requested: amount,
                hint: "Lower amount or raise SHX_MAX_SWAP_LAMPORTS in .env",
              },
              true
            );
          }
        } catch {
          return jsonText({ error: "amount must be integer string (lamports)" }, true);
        }

        const data = (await apiGet(
          `/api/agent/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&taker=${encodeURIComponent(taker)}`
        )) as Record<string, unknown>;

        return jsonText({
          ...data,
          _mcp: {
            dryRun,
            nextStep: dryRun
              ? "Review quote. Re-call with dryRun=false then shx_execute_swap with confirm=true"
              : "Call shx_execute_swap with transaction + requestId and confirm=true",
            safety: {
              maxSwapLamports: MAX_SWAP_LAMPORTS.toString(),
              buyingShxZeroFee: outputMint === SHX_MINT,
            },
          },
        });
      }

      case "shx_swap_intent": {
        const sellSymbol = String(args.sellSymbol || "").toUpperCase();
        const buySymbol = String(args.buySymbol || "").toUpperCase();
        const amountUi = Number(args.amountUi);
        const taker =
          (args.taker as string) || wallet?.publicKey.toBase58() || "";
        const dryRun = args.dryRun !== false; // default true for intent

        if (!sellSymbol || !buySymbol || !(amountUi > 0) || !taker) {
          return jsonText(
            {
              error: "sellSymbol, buySymbol, amountUi>0, and taker/local wallet required",
            },
            true
          );
        }

        const resolved = (await apiGet(
          `/api/agent/resolve?symbol=${encodeURIComponent(`${sellSymbol},${buySymbol}`)}`
        )) as {
          tokens?: Record<string, { mint: string; decimals: number; name: string }>;
          [k: string]: unknown;
        };

        // resolve API may return map under tokens or direct keys
        let sell: { mint: string; decimals: number } | null = null;
        let buy: { mint: string; decimals: number } | null = null;

        if (resolved.tokens) {
          sell = resolved.tokens[sellSymbol] || null;
          buy = resolved.tokens[buySymbol] || null;
        } else {
          // some responses nest differently
          const anyRes = resolved as any;
          sell = anyRes[sellSymbol] || anyRes.resolved?.[sellSymbol] || null;
          buy = anyRes[buySymbol] || anyRes.resolved?.[buySymbol] || null;
        }

        // Fallback known mints
        const KNOWN: Record<string, { mint: string; decimals: number }> = {
          SOL: { mint: SOL_MINT, decimals: 9 },
          WSOL: { mint: SOL_MINT, decimals: 9 },
          USDC: { mint: USDC_MINT, decimals: 6 },
          SHX: { mint: SHX_MINT, decimals: 9 },
        };
        if (!sell) sell = KNOWN[sellSymbol] || null;
        if (!buy) buy = KNOWN[buySymbol] || null;

        if (!sell || !buy) {
          return jsonText(
            { error: "Could not resolve symbols", sellSymbol, buySymbol, resolved },
            true
          );
        }

        const raw = BigInt(Math.floor(amountUi * 10 ** sell.decimals)).toString();
        const quote = await apiGet(
          `/api/agent/quote?inputMint=${encodeURIComponent(sell.mint)}&outputMint=${encodeURIComponent(buy.mint)}&amount=${encodeURIComponent(raw)}&taker=${encodeURIComponent(taker)}`
        );

        return jsonText({
          intent: {
            sellSymbol,
            buySymbol,
            amountUi,
            inputMint: sell.mint,
            outputMint: buy.mint,
            amountRaw: raw,
            dryRun,
          },
          quote,
          _mcp: {
            note: dryRun
              ? "dryRun default true for intents. Set dryRun=false on shx_swap_intent after review, then execute."
              : "Pass quote.transaction + quote.requestId to shx_execute_swap with confirm=true",
          },
        });
      }

      case "shx_execute_swap": {
        if (!ALLOW_EXECUTE) {
          return jsonText(
            { error: "Execute disabled (SHX_ALLOW_EXECUTE=0)" },
            true
          );
        }
        if (!wallet) {
          return jsonText(
            {
              error: "WALLET_PRIVATE_KEY not configured — cannot sign locally",
              hint: "Set base58 secret in mcp-server/.env for sign-enabled mode",
            },
            true
          );
        }
        if (args.confirm !== true) {
          return jsonText(
            {
              error: "confirm must be true",
              hint: "Safety latch: re-call shx_execute_swap with confirm=true only after human/agent review",
            },
            true
          );
        }

        const transaction = String(args.transaction || "");
        const requestId = String(args.requestId || "");
        if (!transaction || !requestId) {
          return jsonText({ error: "transaction and requestId required" }, true);
        }

        const txBuffer = Buffer.from(transaction, "base64");
        const vtx = VersionedTransaction.deserialize(txBuffer);
        vtx.sign([wallet]);
        const signedTransaction = Buffer.from(vtx.serialize()).toString("base64");

        const data = await apiPost("/api/agent/swap", {
          signedTransaction,
          requestId,
          agentPubkey: wallet.publicKey.toBase58(),
        });

        return jsonText({
          ...(data as object),
          _mcp: {
            signedLocally: true,
            wallet: wallet.publicKey.toBase58(),
            note: "Private key never left this MCP process",
          },
        });
      }

      default:
        return jsonText({ error: `Unknown tool: ${name}` }, true);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonText({ error: msg }, true);
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[shx-mcp] v2 running stdio · ${wallet ? "sign-enabled" : "read-only"} · ${SHX_API_URL}`
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
