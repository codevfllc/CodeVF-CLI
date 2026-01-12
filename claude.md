# CodeVF CLI - Technical Specification

## 1. Purpose

The CodeVF CLI is a customer-facing tool that enables:
- MCP setup for Claude Code, Codex, and Gemini
- MCP server runtime for CodeVF tools

**Key Principle**: The CLI is a transport layer only. All business logic resides in the backend.

## 2. Platform Requirements

- **Platforms**: macOS, Linux, Windows
- **Privileges**: No root/admin required
- **Transport**: HTTPS for all API calls
- **Security**: Local secure token storage

## 3. Current Development Scope (IMPORTANT)

**ACTIVE SCOPE: Public Commands**
- **Primary Command**: `codevf setup`
- **Secondary Commands**: `codevf mcp stdio`, `codevf mcp http --port 3333`
- **Status**: Active development and user-facing

### Files In Active Scope
- ✅ `src/commands/setup.ts` - Setup command implementation
- ✅ `src/commands/mcp.ts` - MCP command implementation
- ✅ `src/mcp/index.ts` - MCP server configuration
- ✅ `src/mcp/tools/*` - MCP tools (accessible through MCP clients)
- ✅ `src/modules/tunnel.ts` - Tunnel management (used by MCP tools)

### Development Guidelines
1. **Always verify scope** before making changes
2. **Setup-related features** should be in `setup.ts` or MCP tools
3. **MCP tools** are the primary user-facing functionality
4. **Ask for confirmation** if a request seems to affect commands outside the active scope

## 4. CLI Commands (Public)

### `codevf setup`
- Guides the user through MCP configuration
- Writes MCP settings for supported clients

### `codevf mcp stdio`
- Launches the MCP server over stdio

### `codevf mcp http --port 3333`
- Launches the MCP server over HTTP/SSE
