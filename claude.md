# CodeVF CLI - Technical Specification

## 1. Purpose

The CodeVF CLI is a customer-facing tool that enables:
- Authentication with CodeVF backend
- Project initialization and configuration
- Code metadata upload
- Live debugging sessions with vetted engineers
- Safe terminal interactions with engineers
- Restricted Git branch management (`codevf` branch)
- Credit usage tracking for live support

**Key Principle**: The CLI is a transport layer only. All business logic resides in the backend.

## 2. Platform Requirements

- **Platforms**: macOS, Linux, Windows
- **Privileges**: No root/admin required
- **Transport**: HTTPS for all API calls
- **Security**: Local secure token storage
- **Git Integration**: Backend handles PRs (no direct GitHub manipulation)

## 3. Current Development Scope (IMPORTANT)

**⚠️ SETUP-ONLY MODE ACTIVE**

The CLI is currently in **beta** with `SETUP_ONLY_MODE=true` (see `src/index.ts`). This means:

### ACTIVE SCOPE: `codevf setup` Command Only
- **Primary Command**: Only `codevf setup` is enabled for end users
- **Purpose**: Configure MCP server integration with Claude Code
- **Status**: Active development and user-facing

### RESTRICTED: Other Commands (Disabled in Beta)
The following commands are **disabled** for end users and should **NOT** be modified unless explicitly requested:
- `codevf login` - Authentication (disabled)
- `codevf logout` - Logout (disabled)
- `codevf init` - Project initialization (disabled)
- `codevf sync` - Repository sync (disabled)
- `codevf tasks` - Task listing (disabled)
- `codevf fix` - Live debug sessions (disabled)

### Files In Active Scope:
- ✅ `src/commands/setup.ts` - Setup command implementation
- ✅ `src/mcp/index.ts` - MCP server configuration
- ✅ `src/mcp/tools/*` - MCP tools (accessible through Claude Code)
- ✅ `src/modules/tunnel.ts` - Tunnel management (used by MCP tools)

### Files Out of Scope (Do Not Modify):
- ❌ `src/commands/fix.tsx` - Disabled in beta
- ❌ `src/commands/login.ts` - Disabled in beta
- ❌ `src/commands/init.ts` - Disabled in beta
- ❌ `src/commands/sync.ts` - Disabled in beta
- ❌ `src/commands/tasks.ts` - Disabled in beta
- ❌ `src/commands/logout.ts` - Disabled in beta

### Development Guidelines:
1. **Always verify scope** before making changes
2. **Setup-related features** should be in `setup.ts` or MCP tools
3. **MCP tools** are the primary user-facing functionality
4. **Ask for confirmation** if a request seems to affect disabled commands

### When to Work on Other Commands:
Only modify disabled commands if:
- User explicitly requests changes to disabled features
- User confirms they understand the feature is not currently available
- Changes are for future preparation with clear documentation

**Remember**: The MCP tools (`codevf-tunnel`, `codevf-instant`, `codevf-chat`) are accessible through Claude Code and are in active scope.

## 4. Project Structure

### Local Files Created by `codevf init`

```
.codevf/
├── config.json          # Project configuration
├── last_sync.json       # Last sync metadata
└── cache/               # Temporary cache files
```

### Config File Schema

**.codevf/config.json**
```json
{
  "projectId": "<uuid>",
  "allowedTools": ["claude", "gemini"],
  "testCommand": "npm test",
  "buildCommand": "npm run build",
  "repoUploaded": true,
  "branchMode": "codevf",
  "createdAt": "2025-11-30T...",
  "version": "1"
}
```

### Auth Storage

**~/.config/codevf/auth.json**
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "expiresAt": "2025-12-01T...",
  "userId": "<uuid>"
}
```

## 5. CLI Commands (MVP)

### 5.1 Authentication

#### `codevf login`
- Opens browser OAuth URL
- Backend returns short-lived token + refresh token
- Stores credentials in `~/.config/codevf/auth.json`

#### `codevf logout`
- Deletes `auth.json`
- Clears local session

### 5.2 Project Initialization

#### `codevf init`

**Interactive Wizard Flow**:
1. Detect project type (auto-detect package.json, go.mod, requirements.txt, etc.)
2. Confirm with customer
3. Ask for test command (default based on project type)
4. Ask for build command (default based on project type)
5. Ask for allowed AI tools (multi-select: Claude/Gemini/GPT/None)
6. Ask: "Upload code for faster debugging?" (y/n)
   - If yes: zip + upload via `POST /upload-repo-snapshot`
7. Ask: "Allow engineers access to codevf branch only?" (y/n)
8. Generate `.codevf/config.json`
9. Register project: `POST /project/init`
10. Print summary

### 5.3 Live Debug Session

#### `codevf fix "<issue description>"`

**Actions**:
1. Create task: `POST /tasks/create`
2. Connect WebSocket: `/tasks/<id>/ws`
3. Enter Live Mode UI

**Live Mode Interface**:
```
┌─────────────────────────────────────────────┐
│ Engineer connecting...                      │
│ Engineer connected: Maria (ex-FAANG)        │
│ Billing: 1 credit/min                       │
│ You can chat below. Press CTRL+C to exit   │
├─────────────────────────────────────────────┤
│ [12:34] Maria: Hello! I see you're having   │
│              authentication issues...       │
│                                             │
│ [12:35] You: Yes, users can't login         │
│                                             │
│ [12:36] Maria: Let me check your auth flow  │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Engineer requests to run: npm test      │ │
│ │ Allow? (y/n):                           │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ Credits used: 3                             │
└─────────────────────────────────────────────┘
```

**Permission Requests**:

1. **Command Execution**:
   ```
   Engineer requests to run: npm test
   Allow? (y/n):
   ```
   - If `y`: Execute locally, capture output, send to backend
   - If `n`: Send rejection to backend

2. **File Access**:
   ```
   Engineer requests: src/auth.js
   Allow? (y/n):
   ```
   - If `y`: Upload file via `POST /tasks/<id>/upload-file`
   - If `n`: Send rejection

3. **Screenshare**:
   ```
   Engineer requests screenshare:
   Open link: https://meet.codevf.com/abc123
   ```
   - Display link for customer to open

**Billing Display**:
- Update every minute from backend events
- Show: `Credits used: X`

**Exit Flow**:
1. User presses CTRL+C
2. Send: `POST /tasks/<id>/end-session`
3. Display summary:
   ```
   Session Summary
   ───────────────
   Engineer: Maria
   Time: 12 minutes
   Credits Used: 12

   Rate engineer (1-5):
   ```
4. Send rating: `POST /tasks/<id>/rate`

### 5.4 Sync Repository

#### `codevf sync`

**Flow**:
1. Detect current branch
2. If not on `codevf` branch:
   ```
   Please commit your changes to the 'codevf' branch.

   To create and switch:
     git checkout -b codevf
     git add .
     git commit -m "Your changes"
     codevf sync
   ```
3. If on correct branch:
   - `POST /project/sync` with metadata
   - Upload HEAD commit hash
   - Notify backend engineers can access branch

**Note**: Code is only uploaded if customer opted in during `init` or engineer explicitly requests.

## 6. CLI Internal Architecture

### 6.1 Technology Stack

**Language**: Node.js + TypeScript

**Dependencies**:
- `yargs` - CLI argument parsing
- `ink` + `react` - Terminal UI components
- `ws` - WebSocket client
- `axios` - HTTP client
- `ora` - Loading spinners
- `chalk` - Terminal colors
- `prompts` - Interactive prompts
- `archiver` - Zip creation
- `keytar` (optional) - Secure credential storage

### 6.2 Module Structure

```
src/
├── commands/
│   ├── login.ts          # Authentication
│   ├── logout.ts         # Logout
│   ├── init.ts           # Project initialization
│   ├── fix.ts            # Live debug session
│   └── sync.ts           # Repository sync
├── modules/
│   ├── auth.ts           # Auth token management
│   ├── config.ts         # Config file management
│   ├── api.ts            # HTTP API client
│   ├── websocket.ts      # WebSocket client
│   ├── permissions.ts    # Permission manager
│   └── git.ts            # Git operations
├── ui/
│   ├── LiveSession.tsx   # Ink component for live mode
│   ├── InitWizard.tsx    # Ink component for init
│   └── components/       # Reusable UI components
├── types/
│   └── index.ts          # TypeScript types
├── utils/
│   ├── errors.ts         # Error handling
│   ├── detect.ts         # Project type detection
│   └── upload.ts         # File upload utilities
└── index.ts              # CLI entry point
```

## 7. API Endpoints

### Authentication
- `POST /auth/init` - Initiate OAuth flow
- `POST /auth/token` - Exchange code for tokens

### Project Management
- `POST /project/init` - Register new project
- `POST /project/sync` - Sync project metadata
- `POST /upload-repo-snapshot` - Upload code snapshot

### Task Management
- `POST /tasks/create` - Create new debug task
- `GET /tasks/<id>/events` - WebSocket connection
- `POST /tasks/<id>/send-message` - Send chat message
- `POST /tasks/<id>/approve-command` - Approve command execution
- `POST /tasks/<id>/upload-file` - Upload requested file
- `POST /tasks/<id>/end-session` - End debug session
- `POST /tasks/<id>/rate` - Rate engineer

## 8. WebSocket Protocol

### Event Types

**Incoming** (Backend → CLI):
- `engineer_message` - Chat message from engineer
- `engineer_connected` - Engineer joined session
- `request_command` - Engineer requests command execution
- `request_file` - Engineer requests file access
- `screenshare_request` - Engineer requests screenshare
- `billing_update` - Credit usage update
- `session_end` - Session terminated

**Outgoing** (CLI → Backend):
- `customer_message` - Chat message from customer
- `approve_command` - Command approval + result
- `approve_file` - File approval + content
- `command_output` - Command execution output
- `file_upload` - File content
- `end_session` - Customer ending session

### Message Format

```typescript
interface WebSocketMessage {
  type: string;
  timestamp: string;
  payload: any;
}
```

## 9. Permission Model

### Customer Approvals Required For:
- Running any command
- Reading any file
- Accessing logs
- Screenshare requests
- Write actions
- Branch changes

### Engineer Restrictions:
- Access limited to live session interaction
- Access limited to `codevf` Git branch
- All actions logged and auditable
- Cannot execute commands without approval
- Cannot access files without approval

## 10. Error Handling

### Error Scenarios:
1. **No Internet Connection**
   ```
   Error: Cannot connect to CodeVF servers.
   Please check your internet connection.
   ```

2. **Invalid Token**
   ```
   Error: Authentication failed.
   Please run: codevf login
   ```

3. **Missing config.json**
   ```
   Error: No CodeVF project found.
   Please run: codevf init
   ```

4. **WebSocket Disconnect**
   ```
   Warning: Connection lost. Reconnecting...
   ```

5. **Engineer Unavailable**
   ```
   No engineers available right now.
   Average wait time: 5 minutes
   Continue waiting? (y/n)
   ```

6. **Permission Denied**
   ```
   Engineer: Command denied by customer
   ```

7. **Command Failed**
   ```
   Command failed with exit code 1:
   [output]
   ```

8. **Dirty Git State**
   ```
   Error: Working directory has uncommitted changes.
   Please commit or stash changes before syncing.

   Use --force to sync anyway (not recommended)
   ```

### Error Types (TypeScript)
```typescript
class CodeVFError extends Error {
  code: string;
  recoverable: boolean;
}

class AuthError extends CodeVFError {}
class NetworkError extends CodeVFError {}
class ConfigError extends CodeVFError {}
class PermissionError extends CodeVFError {}
class GitError extends CodeVFError {}
```

## 11. Non-Goals for v1

The CLI will **NOT**:
- Create PRs from CLI (backend handles this)
- Run local AI models
- Generate code
- Manage async task queues
- Handle engineer-task assignment logic
- Manage GitHub/GitLab tokens directly
- Implement business logic (backend only)

## 12. Security Considerations

### Token Storage
- Tokens stored in user config directory (`~/.config/codevf/`)
- File permissions: `0600` (read/write owner only)
- Tokens never logged or displayed
- Refresh token rotation

### File Upload
- Customer approval required
- File size limits enforced
- Binary files excluded by default
- Sensitive files warned (.env, credentials, keys)

### Command Execution
- Customer approval required for each command
- Commands run with customer's user permissions
- Output sanitized before sending
- Timeout limits enforced

### Network Security
- All connections over HTTPS/WSS
- Certificate validation enforced
- No proxy credential storage
- Request signing for sensitive operations

## 13. Testing Strategy

### Unit Tests
- Each module independently tested
- Mock API responses
- Mock WebSocket connections
- Error scenario coverage

### Integration Tests
- End-to-end command flows
- WebSocket reconnection
- File upload/download
- Permission workflows

### Manual Testing Checklist
- [ ] Login flow on all platforms
- [ ] Init wizard with different project types
- [ ] Live session with command execution
- [ ] Live session with file requests
- [ ] Network interruption recovery
- [ ] Token expiration and refresh
- [ ] Permission denial flows
- [ ] Git branch detection
- [ ] Sync with dirty working directory

## 14. Development Phases

### Phase 1: Core Infrastructure
- Project setup (package.json, TypeScript config)
- Auth module (login/logout)
- Config management
- API client wrapper

### Phase 2: Init & Sync
- Init wizard
- Project type detection
- Repo upload
- Sync command

### Phase 3: Live Session
- WebSocket client
- Live UI with Ink
- Chat functionality
- Permission workflows

### Phase 4: Polish
- Error handling
- Cross-platform testing
- Documentation
- Example flows

## 15. Success Metrics

### Technical Metrics
- Command response time < 200ms (local operations)
- WebSocket latency < 100ms
- File upload speed > 1MB/s
- Zero credential leaks

### User Experience Metrics
- Clear error messages (100% coverage)
- Permission prompts easy to understand
- Session status always visible
- Credit usage transparent

## 16. Future Enhancements (Post-v1)

- Offline mode for reading logs
- Local caching of common responses
- Plugin system for custom commands
- Integration with IDE extensions
- Mobile companion app
- Session recording/playback
- Multi-language support
- Voice chat integration

## 17. Hybrid Mode & AI Integration (In Development)

The CLI now supports optional AI integration via OpenCode SDK with intelligent hybrid mode:

### Key Features
- **AI-First Routing**: Quick tasks handled by AI instantly (free with limits)
- **Hybrid Mode**: Automatic fallback from AI to human engineers
- **Context-Aware Handoff**: AI transcripts shared with engineers for faster resolution
- **Vibe Mode**: Engineers help AI succeed by providing context or refining prompts

### Documentation
For detailed implementation plans, see:
- [AI_AGENT_OPENCODE_PLAN.md](../AI_AGENT_OPENCODE_PLAN.md) - AI agent integration architecture
- [HYBRID_MODE_IMPROVEMENT_PLAN.md](../HYBRID_MODE_IMPROVEMENT_PLAN.md) - Context handoff & engineer workflow

### User Guide
See [Hybrid Mode Usage Guide](../HYBRID_MODE_USAGE.md) (to be created) for:
- When to use AI vs Human vs Hybrid mode
- How context sharing works
- Privacy controls and data handling
- Pricing and credit usage
