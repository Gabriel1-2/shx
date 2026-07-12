import { NextRequest, NextResponse } from "next/server";

/**
 * HTTP MCP catalog + remote tool proxy (read-oriented).
 * Full signing stays in the local stdio MCP (mcp-server/) so keys never hit the web.
 */

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Powered-By": "SHX MCP Catalog",
};

const TOOLS = [
    {
        name: "shx_health",
        description: "Agent API health, fee tiers, endpoints",
        path: "GET /api/agent/health",
        localMcpOnly: false,
    },
    {
        name: "shx_connect",
        description: "Wallet balances, tier, symbol map",
        path: "GET /api/agent/connect?wallet=",
        localMcpOnly: false,
    },
    {
        name: "shx_resolve",
        description: "Symbol → mint",
        path: "GET /api/agent/resolve?symbol=",
        localMcpOnly: false,
    },
    {
        name: "shx_tokens",
        description: "Watchlist + prices",
        path: "GET /api/agent/tokens",
        localMcpOnly: false,
    },
    {
        name: "shx_check_tier",
        description: "Fee tier for wallet",
        path: "GET /api/agent/tier?wallet=",
        localMcpOnly: false,
    },
    {
        name: "shx_live_stats",
        description: "Public traders / volume / fees",
        path: "GET /api/stats/live",
        localMcpOnly: false,
    },
    {
        name: "shx_get_quote",
        description: "Quote + unsigned tx (agent must sign)",
        path: "GET /api/agent/quote",
        localMcpOnly: false,
    },
    {
        name: "shx_execute_swap",
        description: "Submit signed tx — or use local MCP for key custody",
        path: "POST /api/agent/swap",
        localMcpOnly: false,
    },
    {
        name: "shx_swap_intent",
        description: "Symbol-based quote helper (local MCP)",
        path: "stdio mcp-server",
        localMcpOnly: true,
    },
];

export async function OPTIONS() {
    return NextResponse.json({}, { headers: CORS });
}

export async function GET() {
    const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : "https://shx.exchange";

    return NextResponse.json(
        {
            name: "SHX Exchange MCP",
            version: "2.0.0",
            protocol: "model-context-protocol",
            description:
                "Agent-native Solana DEX tools. Prefer local stdio MCP for signing; HTTP exposes catalog + REST agent API.",
            homepage: origin,
            documentation: `${origin}/llms.txt`,
            agentApi: `${origin}/api/agent/health`,
            localServer: {
                package: "mcp-server/",
                install: "cd mcp-server && npm i && npm run build",
                entry: "mcp-server/build/index.js",
                transport: "stdio",
                env: ["SHX_API_URL", "WALLET_PRIVATE_KEY?", "SHX_MAX_SWAP_LAMPORTS?"],
            },
            tools: TOOLS,
            safety: {
                signing: "Local stdio MCP signs with WALLET_PRIVATE_KEY; never send keys over HTTP",
                confirm: "shx_execute_swap requires confirm=true in local MCP",
                maxSwap: "SHX_MAX_SWAP_LAMPORTS caps SOL sells in local MCP",
            },
            claudeDesktopExample: {
                mcpServers: {
                    "shx-exchange": {
                        command: "node",
                        args: ["<path>/mcp-server/build/index.js"],
                        env: { SHX_API_URL: origin },
                    },
                },
            },
            timestamp: new Date().toISOString(),
        },
        { headers: CORS }
    );
}

/**
 * POST { tool, arguments } — thin proxy to public agent REST (no local signing).
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const tool = String(body.tool || body.name || "");
        const args = (body.arguments || body.args || {}) as Record<string, string>;
        const origin = new URL(req.url).origin;

        const map: Record<string, () => Promise<Response>> = {
            shx_health: () => fetch(`${origin}/api/agent/health`),
            shx_live_stats: () => fetch(`${origin}/api/stats/live`),
            shx_connect: () => {
                if (!args.wallet) throw new Error("wallet required");
                return fetch(
                    `${origin}/api/agent/connect?wallet=${encodeURIComponent(args.wallet)}`
                );
            },
            shx_resolve: () =>
                fetch(
                    `${origin}/api/agent/resolve${
                        args.symbol
                            ? `?symbol=${encodeURIComponent(args.symbol)}`
                            : ""
                    }`
                ),
            shx_tokens: () =>
                fetch(
                    `${origin}/api/agent/tokens${
                        args.mint ? `?mint=${encodeURIComponent(args.mint)}` : ""
                    }`
                ),
            shx_check_tier: () => {
                if (!args.wallet) throw new Error("wallet required");
                return fetch(
                    `${origin}/api/agent/tier?wallet=${encodeURIComponent(args.wallet)}`
                );
            },
            shx_get_quote: () => {
                const { inputMint, outputMint, amount, taker } = args;
                if (!inputMint || !outputMint || !amount || !taker) {
                    throw new Error("inputMint, outputMint, amount, taker required");
                }
                const q = new URLSearchParams({ inputMint, outputMint, amount, taker });
                return fetch(`${origin}/api/agent/quote?${q}`);
            },
        };

        if (tool === "shx_execute_swap" || tool === "shx_swap_intent") {
            return NextResponse.json(
                {
                    error:
                        "Use local mcp-server for execute / intent helpers (key custody + safety latches)",
                    docs: "/api/mcp",
                },
                { status: 400, headers: CORS }
            );
        }

        const fn = map[tool];
        if (!fn) {
            return NextResponse.json(
                { error: `Unknown or unsupported HTTP tool: ${tool}`, tools: Object.keys(map) },
                { status: 400, headers: CORS }
            );
        }

        const res = await fn();
        const data = await res.json();
        return NextResponse.json(
            { tool, ok: res.ok, status: res.status, result: data },
            { status: res.ok ? 200 : res.status, headers: CORS }
        );
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "MCP proxy error";
        return NextResponse.json({ error: msg }, { status: 400, headers: CORS });
    }
}
