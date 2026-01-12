# CodeVF CLI

Connect Claude Code, Codex, or Gemini to live human engineers.

## Install

```bash
npm install -g codevf
```

## Quick Start (Claude Code)

1. `codevf setup`
2. In Claude Code, type `claude`
3. It works out of the box

Use `/cvf` in Claude Code to force CodeVF.

## Quick Start (Codex)

1. `codevf setup`
2. In Codex, type `codex`
3. It works out of the box

Use `/mcp` in Codex to confirm CodeVF is connected.

## Quick Start (Gemini)

1. `codevf setup`
2. In Gemini, restart the client
3. It works out of the box

## Commands

### `codevf setup` (Beta - Primary Command)
Configure MCP server integration with Claude Code, Codex, and Gemini:
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

## Requirements

- Node.js 18+
- [Claude Code (Desktop App)](https://claude.ai/download)
- Internet connection

## Support

- Documentation: https://docs.codevf.com
- Issues: https://github.com/codevf/cli/issues
- Email: support@codevf.com

## License

Commercial license — see `LICENSE`.
