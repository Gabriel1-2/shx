# SHX Exchange MCP Server

An official Model Context Protocol (MCP) server for the SHX Exchange. 
This server allows local AI assistants (like Claude Desktop, Cursor, or local CLI agents) to fetch quotes and execute secure, local-signed trades on the Solana blockchain.

## Secure Local Signing
The core advantage of using this MCP server is that your AI agent never sees your private key. You configure the server locally with a `.env` file, and when the AI requests to execute a trade, the MCP server will securely sign the transaction locally on your machine before submitting it to the network!

## Installation & Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the server:
   ```bash
   npm run build
   ```

3. Configure your local wallet:
   Create a `.env` file in this directory and paste your base58 Solana private key:
   ```env
   WALLET_PRIVATE_KEY=your_base58_private_key_here
   SHX_API_URL=https://shx.exchange
   ```
   *Note: If no private key is provided, the server will run in read-only mode.*

## Usage with Claude Desktop

Add the following to your `claude_desktop_config.json` (usually located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "shx-exchange": {
      "command": "node",
      "args": [
        "path/to/shx_exchange/mcp-server/build/index.js"
      ]
    }
  }
}
```

Restart Claude Desktop, and you can now say:
> "Buy 0.1 SOL worth of SHX using my connected wallet!"
