# CodeVF CLI

**⚠️ BETA:** Connect Claude Code to live human engineers for complex debugging.

## Installation

```bash
npm install -g codevf
```

## Quick Start

The CodeVF CLI is currently in **setup-only mode** for connecting Claude Code to CodeVF's MCP server:

```bash
# Setup MCP server integration with Claude Code
codevf setup

# After setup, use Claude Code with /cvf commands:
# /cvf Does this authentication fix prevent timing attacks?
# /cvf Complex race condition in WebSocket reconnection needs debugging  
# /cvf Create tunnel to my dev server on port 3000
```

**Three tools available in Claude Code:**
- `codevf-instant` - Quick validation queries (4-minute max)
- `codevf-chat` - Extended debugging sessions (up to 2 hours) 
- `codevf-tunnel` - Share local dev servers securely

## Commands

### `codevf setup` (Beta - Primary Command)
Configure MCP server integration with Claude Code:
- Authenticate with CodeVF using OAuth
- Auto-configure Claude Code's `~/.claude.json` file
- Create `/cvf` slash command for Claude Code
- Select default project for context

### `codevf mcp stdio|http`
Start the MCP server for non-Claude clients:
- `codevf mcp stdio` - Launch MCP over stdio (command/args-based clients)
- `codevf mcp http --port 3333` - Launch MCP over HTTP/SSE (shows endpoints)

### Claude Code Integration (After Setup)
Once configured, use these tools directly in Claude Code:

**`/cvf [message]` - Smart routing to appropriate tool**
- Quick questions → `codevf-instant` (4min max, good for validation)
- Complex debugging → `codevf-chat` (extended sessions up to 2 hours)
- Local server access → `codevf-tunnel` (share dev servers securely)

**Example usage:**
```
/cvf Does this authentication fix prevent timing attacks?
/cvf Complex race condition in WebSocket reconnection needs debugging
/cvf Create tunnel to my dev server on port 3000
```

### Other Commands (Disabled in Beta)
The following commands exist but are **disabled** in beta mode:
- `codevf login` - Direct CLI authentication (use `setup` instead)
- `codevf init` - Project initialization (handled via MCP tools)
- `codevf fix` - Direct CLI debugging sessions (use Claude Code instead)
- `codevf sync` - Repository sync (handled via MCP tools)

## How It Works

1. **Setup once** - Run `codevf setup` to configure Claude Code integration
2. **Work in Claude Code** - Use `/cvf` commands to access human engineers
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

## Beta Status & Roadmap

**Current Beta Features:**
- ✅ MCP server integration with Claude Code
- ✅ Three tools: instant, chat, tunnel  
- ✅ OAuth authentication and project selection

**Coming Soon:**
- 🔄 Direct CLI debugging sessions (`codevf fix`)
- 🔄 Project initialization (`codevf init`) 
- 🔄 Repository sync (`codevf sync`)
- 🔄 Standalone terminal UI

## Support

- Documentation: https://docs.codevf.com
- Issues: https://github.com/codevf/cli/issues
- Email: support@codevf.com

## License

Commercial license — see `LICENSE`. Use is limited to interacting with CodeVF services; no redistribution or competing uses.
