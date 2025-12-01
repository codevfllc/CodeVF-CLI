# Architecture Overview

This document describes the internal architecture of the CodeVF CLI.

## High-Level Design

The CLI is designed as a **transport layer** between the customer and the CodeVF backend. It does not contain business logic - all intelligence lives in the backend.

```
┌──────────────┐
│   Customer   │
└──────┬───────┘
       │
       ├─ Commands (login, init, sync, fix)
       │
┌──────▼───────────────────────────────────────┐
│          CodeVF CLI (Transport Layer)        │
├──────────────────────────────────────────────┤
│  • Authentication                            │
│  • Configuration Management                  │
│  • WebSocket Client                          │
│  • Permission Manager                        │
│  • Terminal UI (Ink/React)                   │
└──────┬───────────────────────────────────────┘
       │
       │ HTTPS/WSS
       │
┌──────▼───────────────────────────────────────┐
│         CodeVF Backend (Business Logic)      │
├──────────────────────────────────────────────┤
│  • Engineer Matching                         │
│  • Task Management                           │
│  • Billing                                   │
│  • Code Analysis                             │
│  • AI Tool Integration                       │
└──────────────────────────────────────────────┘
```

## Module Structure

### Commands Layer (`src/commands/`)
Entry points for CLI commands. Thin wrappers that orchestrate modules.

- **login.ts**: OAuth flow initiation and polling
- **logout.ts**: Clear local authentication
- **init.ts**: Project initialization wizard
- **sync.ts**: Git sync workflow
- **fix.tsx**: Live debugging session orchestration

### Modules Layer (`src/modules/`)
Core business logic and external integrations.

#### AuthManager (`auth.ts`)
- Manages authentication tokens
- Stores in `~/.config/codevf/auth.json` with 0600 permissions
- Token expiration checking
- Auto-refresh (future)

#### ConfigManager (`config.ts`)
- Manages project configuration
- Stores in `.codevf/config.json`
- Tracks last sync metadata
- Cache management

#### ApiClient (`api.ts`)
- HTTP client wrapper around axios
- Automatic auth token injection
- Error handling and retry logic
- All backend API endpoints

#### WebSocketClient (`websocket.ts`)
- Real-time communication channel
- Auto-reconnection with exponential backoff
- Event-based message handling
- Connection state management

#### GitManager (`git.ts`)
- Git operations wrapper
- Branch management
- Commit tracking
- Status checking

#### PermissionManager (`permissions.ts`)
- Interactive permission prompts
- Command approval
- File access approval
- Warning for sensitive files

### UI Layer (`src/ui/`)
Terminal-based user interfaces built with Ink (React for terminals).

#### LiveSession (`LiveSession.tsx`)
Real-time chat interface with:
- Message history display
- Input handling
- Engineer info display
- Billing display
- Permission request overlays

### Types Layer (`src/types/`)
TypeScript type definitions for:
- API contracts
- WebSocket messages
- Configuration schemas
- Error types

### Utils Layer (`src/utils/`)
Utility functions:
- **errors.ts**: Error handling and formatting
- **detect.ts**: Project type detection
- **upload.ts**: Repo archiving and upload

## Data Flow

### 1. Authentication Flow
```
Customer           CLI              Backend
   │                │                   │
   │─ codevf login ─▶│                   │
   │                │─ POST /auth/init ─▶│
   │                │◀─ {authUrl, poll} ─│
   │◀─ Open browser ─│                   │
   │                │                   │
   │─ Authorize ─────────────────────────▶│
   │                │                   │
   │                │─ Poll /auth/token ─▶│
   │                │◀─ {tokens} ────────│
   │                │                   │
   │◀─ Success ──────│                   │
```

### 2. Init Flow
```
Customer           CLI              Backend
   │                │                   │
   │─ codevf init ──▶│                   │
   │                │─ Detect project ──│
   │◀─ Wizard ───────│                   │
   │─ Answers ───────▶│                   │
   │                │─ POST /project/init▶│
   │                │◀─ {projectId} ─────│
   │                │─ Upload code ──────▶│
   │                │─ Save config ──────│
   │◀─ Summary ──────│                   │
```

### 3. Fix Session Flow
```
Customer           CLI              Backend         Engineer
   │                │                   │               │
   │─ codevf fix ───▶│                   │               │
   │                │─ POST /tasks/create▶│               │
   │                │◀─ {taskId} ────────│               │
   │                │─ WS Connect ───────▶│               │
   │                │                   │◀─ Accept task ─│
   │                │◀─ engineer_connected◀───────────────│
   │◀─ UI renders ──│                   │               │
   │                │                   │               │
   │◀─ Message ─────│◀─ engineer_message◀───────────────│
   │─ Reply ────────▶│─ customer_message ──▶───────────▶│
   │                │                   │               │
   │                │◀─ request_command ◀───────────────│
   │◀─ Approve? ────│                   │               │
   │─ Yes ──────────▶│─ Run command ──────│               │
   │                │─ command_output ────▶──────────────▶│
   │                │                   │               │
   │─ CTRL+C ───────▶│─ end_session ──────▶│               │
   │◀─ Rate ────────│                   │               │
   │─ Rating ───────▶│─ POST /tasks/rate ─▶│               │
```

## Security Model

### Authentication
- OAuth 2.0 with PKCE (backend handles)
- JWT access tokens
- Refresh tokens for long-lived sessions
- Tokens stored with 0600 file permissions

### Permission System
- **Command Execution**: Explicit approval required
- **File Access**: Per-file approval
- **Git Access**: Restricted to `codevf` branch
- **Code Upload**: Opt-in only

### Network Security
- All HTTP over TLS (HTTPS)
- All WebSocket over TLS (WSS)
- Certificate pinning (future)
- Request signing for sensitive ops (future)

## Error Handling

### Error Hierarchy
```
CodeVFError (base)
├── AuthError
├── NetworkError
├── ConfigError
├── PermissionError
└── GitError
```

### Error Recovery
- **Network errors**: Auto-retry with backoff
- **Auth errors**: Prompt to re-login
- **Config errors**: Guide to initialization
- **Git errors**: Provide git commands to fix

## Extension Points

### Future Enhancements
1. **Plugin System**: Custom commands via plugins
2. **Hooks**: Pre/post command hooks
3. **Custom UI Themes**: Terminal color schemes
4. **Local AI**: Optional local AI assistance
5. **Multi-Project**: Manage multiple projects
6. **Session Recording**: Record/replay sessions

## Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Load modules on-demand
- **Streaming**: Stream large file uploads
- **Compression**: Gzip HTTP responses
- **Caching**: Cache project metadata
- **Debouncing**: Debounce rapid WebSocket messages

### Resource Limits
- Max file size: 10MB per file
- Max message size: 64KB
- WebSocket timeout: 5 minutes idle
- HTTP timeout: 30 seconds default, 2 minutes for uploads

## Testing Strategy

### Unit Tests
- Pure functions in utils/
- Module methods with mocked dependencies
- React components with ink-testing-library

### Integration Tests
- Command flows with mocked API
- WebSocket message handling
- Git operations with test repo

### E2E Tests (future)
- Full command flows against staging backend
- Real OAuth flow
- Real WebSocket connections

## Deployment

### Build Process
```bash
npm run build    # TypeScript → JavaScript
npm link         # Symlink for local testing
npm publish      # Publish to NPM registry
```

### Distribution
- **NPM Registry**: Primary distribution
- **Homebrew**: macOS package manager
- **apt/yum**: Linux package managers
- **Scoop/Chocolatey**: Windows package managers

### Versioning
- Semantic Versioning (semver)
- Breaking changes: Major version bump
- New features: Minor version bump
- Bug fixes: Patch version bump

## Monitoring & Telemetry

### Metrics (opt-in)
- Command usage
- Error rates
- Session duration
- Platform distribution

### Privacy
- No PII collected
- No code sent without consent
- Anonymized metrics only
- Opt-out available
