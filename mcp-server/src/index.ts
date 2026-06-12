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

const SHX_API_URL = process.env.SHX_API_URL || "https://shx.exchange";

let wallet: Keypair | null = null;
if (process.env.WALLET_PRIVATE_KEY) {
    try {
        const secretKey = bs58.decode(process.env.WALLET_PRIVATE_KEY);
        wallet = Keypair.fromSecretKey(secretKey);
    } catch (e) {
        console.error("Failed to load WALLET_PRIVATE_KEY from .env. The server will run in read-only mode.");
    }
}

const server = new Server(
    {
        name: "shx-mcp-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Register Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "shx_get_quote",
                description: "Get a swap quote and an unsigned transaction from the SHX Exchange. The agent MUST NOT try to sign this transaction manually if a WALLET_PRIVATE_KEY is loaded in the MCP server; it should just pass the base64 transaction to shx_execute_swap.",
                inputSchema: {
                    type: "object",
                    properties: {
                        inputMint: { type: "string", description: "Token mint to sell" },
                        outputMint: { type: "string", description: "Token mint to buy" },
                        amount: { type: "string", description: "Amount in smallest unit (lamports)" },
                    },
                    required: ["inputMint", "outputMint", "amount"],
                },
            },
            {
                name: "shx_execute_swap",
                description: "Execute a swap by securely signing the base64 transaction with the local WALLET_PRIVATE_KEY.",
                inputSchema: {
                    type: "object",
                    properties: {
                        transaction: { type: "string", description: "Base64 encoded unsigned transaction returned by shx_get_quote" },
                        requestId: { type: "string", description: "requestId returned by shx_get_quote" },
                    },
                    required: ["transaction", "requestId"],
                },
            },
            {
                name: "shx_check_tier",
                description: "Check the local wallet's SHX token balance and fee tier status on the SHX Exchange.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            }
        ],
    };
});

// Implement Tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!wallet) {
        return {
            isError: true,
            content: [{ type: "text", text: "WALLET_PRIVATE_KEY is not configured in .env. Trades cannot be executed." }]
        };
    }

    const taker = wallet.publicKey.toBase58();

    if (request.params.name === "shx_get_quote") {
        const { inputMint, outputMint, amount } = request.params.arguments as any;
        
        try {
            const url = `${SHX_API_URL}/api/agent/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&taker=${taker}`;
            const res = await fetch(url);
            const data = await res.json();
            
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
            };
        } catch (e: any) {
            return { isError: true, content: [{ type: "text", text: e.message }] };
        }
    }

    if (request.params.name === "shx_execute_swap") {
        const { transaction, requestId } = request.params.arguments as any;
        
        try {
            // Secure Local Signing!
            // 1. Deserialize the base64 unsigned transaction
            const txBuffer = Buffer.from(transaction, 'base64');
            const vtx = VersionedTransaction.deserialize(txBuffer);
            
            // 2. Sign the transaction
            vtx.sign([wallet]);
            
            // 3. Serialize back to base64
            const signedTransaction = Buffer.from(vtx.serialize()).toString('base64');
            
            // 4. Submit to SHX Exchange API
            const res = await fetch(`${SHX_API_URL}/api/agent/swap`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    signedTransaction,
                    requestId,
                })
            });
            const data = await res.json();
            
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
            };
        } catch (e: any) {
            return { isError: true, content: [{ type: "text", text: e.message }] };
        }
    }

    if (request.params.name === "shx_check_tier") {
        try {
            const res = await fetch(`${SHX_API_URL}/api/agent/tier?wallet=${taker}`);
            const data = await res.json();
            
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
            };
        } catch (e: any) {
            return { isError: true, content: [{ type: "text", text: e.message }] };
        }
    }

    return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }]
    };
});

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("SHX Exchange MCP Server is running on stdio!");
}

run().catch(console.error);
