# SHX Exchange MCP Server v2

Official **Model Context Protocol** server for [SHX Exchange](https://shx.exchange).

Lets Claude Desktop, Cursor, and local agents:

- Discover health / fee tiers / live stats  
- Resolve symbols → mints  
- Quote via Jupiter Ultra with SHX fee tiers  
- **Optionally sign & execute locally** (private key never sent to SHX servers)

## Tools

| Tool | Auth | Purpose |
|------|------|---------|
| `shx_health` | none | API status + MCP mode |
| `shx_connect` | wallet | Balances, tier, gas, symbol map |
| `shx_resolve` | none | SOL/USDC/SHX → mint |
| `shx_tokens` | none | Watchlist + prices |
| `shx_check_tier` | wallet | Fee tier |
| `shx_live_stats` | none | Public platform proof |
| `shx_referral_link` | optional | Share / deep links |
| `shx_get_quote` | wallet | Quote + unsigned tx |
| `shx_swap_intent` | wallet | Symbol-based quote (dry-run default) |
| `shx_execute_swap` | **local key** | Sign + submit (`confirm: true`) |

## Setup

```bash
cd mcp-server
npm install
npm run build
```

Create `.env` (optional for read-only):

```env
SHX_API_URL=https://shx.exchange
# Optional — enables shx_execute_swap
WALLET_PRIVATE_KEY=your_base58_secret
# Safety cap on SOL sells (lamports). Default 5 SOL.
SHX_MAX_SWAP_LAMPORTS=5000000000
# Set to 0 to disable execute entirely
SHX_ALLOW_EXECUTE=1
```

## Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json` (Windows) or  
`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "shx-exchange": {
      "command": "node",
      "args": ["C:/absolute/path/to/shx_exchange/mcp-server/build/index.js"],
      "env": {
        "SHX_API_URL": "https://shx.exchange"
      }
    }
  }
}
```

## Cursor

Add the same server under MCP settings (command `node`, args → `build/index.js`).

## Safe agent flow

1. `shx_health`  
2. `shx_connect`  
3. `shx_swap_intent` with `dryRun: true` (default)  
4. Review amounts / fees  
5. `shx_get_quote` or intent with `dryRun: false`  
6. `shx_execute_swap` with **`confirm: true`** only after review  

## HTTP discovery (hosted)

- Agent REST: `https://shx.exchange/api/agent/health`  
- MCP catalog: `https://shx.exchange/api/mcp`  
- Well-known: `https://shx.exchange/.well-known/mcp.json`  
- Docs: `https://shx.exchange/llms.txt`  

## Security

- Prefer **read-only** MCP for untrusted hosts.  
- Never put hot-wallet keys on shared machines.  
- `confirm: true` is required for execute.  
- SOL size cap via `SHX_MAX_SWAP_LAMPORTS`.  

## License

Same as parent SHX Exchange repo.
