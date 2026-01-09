# CodeVF CLI

**⚠️ BETA:** Connect Claude Code to live human engineers for complex debugging.
Default release is **setup-only mode** (MCP integration).

## Installation

```bash
npm install -g codevf
```

## Quick Start (MCP + Claude Code)

The CLI currently ships in **setup-only mode** for Claude Code integration.

```bash
# Run setup directly
codevf setup
```

## Commands

### `codevf setup` (Beta - Primary Command)
Configure MCP server integration with Claude Code:
- Authenticate with CodeVF using OAuth
- Auto-configure Claude Code's `~/.claude.json` file
- Create Claude Code slash commands for CodeVF
- Select default project for context

### `codevf mcp stdio`
Start the MCP server for non-Claude clients:
- `codevf mcp stdio` - Launch MCP over stdio (command/args-based clients)

### `codevf mcp http --port 3333`
Start the MCP server over HTTP/SSE for non-Claude clients:
- `codevf mcp http --port 3333` - Launch MCP over HTTP/SSE (shows endpoints)

## How It Works

1. **Setup once** - Run `codevf setup` to configure Claude Code integration
2. **Work in Claude Code** - Access human engineers through the integration
3. **Get matched with experts** - Ex-FAANG engineers with expertise in your stack
4. **Context-aware handoff** - Engineers see your Claude conversation for faster resolution
5. **Hybrid approach** - AI handles quick questions, humans tackle complex debugging
6. **Pay per minute** - Only pay for active engineering time

## Security & Privacy

- **MCP integration** - No direct code access, works through Claude Code's security model
- **Context sharing** - Engineers see your Claude conversation for better assistance
- **Explicit permission** - Engineers request specific actions with your approval
- **Audit trail** - All engineer actions are logged and auditable
- **Secure tunnels** - Local dev servers shared via encrypted tunnels only when requested
- **Session-based** - No persistent code storage, only active session context

## Configuration

After running `codevf setup`, configuration is stored in:

**MCP Configuration** (`~/.config/codevf/mcp-config.json`):
```json
{
  "auth": {
    "accessToken": "jwt-token",
    "refreshToken": "jwt-token", 
    "userId": "user-uuid"
  },
  "defaultProjectId": "project-uuid",
  "baseUrl": "https://app.codevf.com"
}
```

**Claude Code Configuration** (auto-configured in `~/.claude.json`):
```json
{
  "mcpServers": {
    "codevf": {
      "command": "node",
      "args": ["/path/to/codevf/dist/mcp/index.js"]
    }
  }
}
```

## Requirements

- Node.js 18 or higher
- [Claude Code (Desktop App)](https://claude.ai/download) - Required for MCP integration
- Internet connection
- CodeVF account (created during setup)

### Installing Claude Code

If you don't have Claude Code installed:

**macOS:**
```bash
# Download from website
open https://claude.ai/download

# Or using Homebrew
brew install --cask claude
```

**Windows:**
```bash
# Download installer from website
start https://claude.ai/download
```

**Linux:**
```bash
# Download AppImage from website
curl -L https://claude.ai/download -o claude.appimage
chmod +x claude.appimage
./claude.appimage
```

**Note:** Claude Code requires an Anthropic account. Create one at [claude.ai](https://claude.ai) if needed.

## Support

- Documentation: https://docs.codevf.com
- Issues: https://github.com/codevf/cli/issues
- Email: support@codevf.com

## License

Commercial license — see `LICENSE`. Use is limited to interacting with CodeVF services; no redistribution or competing uses.
