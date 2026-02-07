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
- **Primary Command**: `npx codevf setup`
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

### `npx codevf setup`
- Guides the user through MCP configuration
- Writes MCP settings for supported clients

### `codevf mcp stdio`
- Launches the MCP server over stdio

### `codevf mcp http --port 3333`
- Launches the MCP server over HTTP/SSE

---

## 5. MCP Tools Reference (for AI Agents)

### Overview

CodeVF provides MCP (Model Context Protocol) tools that enable AI agents to collaborate with human engineers in real-time. These tools are designed for programmatic use by AI agents like Claude Code, Codex, and Gemini.

**Key Concepts:**
- **Transport Layer Only**: All business logic resides in the backend; the CLI is a lightweight transport
- **Real-time Collaboration**: Tools establish WebSocket connections for bidirectional communication
- **Credit-based System**: Usage is metered by credits (1 credit ≈ 1 minute of engineer time)
- **Task Continuity**: Active tasks can be resumed, overridden, or extended with follow-ups

---

### Available Tools

#### 🚀 codevf-instant

**Purpose**: Get quick validation or a single response from a human engineer.

**When to Use:**
- Quick questions that need human validation ("Does this fix work?")
- Error identification ("What's wrong with this stack trace?")
- Testing results ("Can you verify this output?")
- Simple debugging queries
- One-off questions that don't require back-and-forth

**When NOT to Use:**
- Complex multi-step debugging (use `codevf-chat` instead)
- Tasks requiring extended collaboration
- Questions needing iterative refinement

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | ✅ Yes | Question or request for the engineer |
| `maxCredits` | number | ✅ Yes | Maximum credits to spend (1-10, default: 10) |
| `attachments` | array | No | File attachments (max 5 files: images, logs, PDFs) |
| `assignmentTimeoutSeconds` | number | No | Engineer assignment timeout (30-1800s, default: 300s) |
| `tagId` | number | No | Engineer expertise level (1=Engineer, 4=Vibe Coder, 5=General Purpose) |
| `continueTaskId` | string | No | Specific task ID to continue (when resuming) |
| `decision` | string | No | How to handle active tasks: `override` or `followup` |
| `agentIdentifier` | string | ⚠️ Important | Your agent name (e.g., "Claude Code", "Codex") for analytics |

**Cost Calculation:**

```
Formula: Final Credits = Base Credits × SLA Multiplier × Tag Multiplier

SLA Multiplier (instant mode): 2.0x
Tag Multipliers:
  - Engineer (tagId: 1): 1.7x
  - Vibe Coder (tagId: 4): 1.5x
  - General Purpose (tagId: 5): 1.0x (default)

Examples:
  10 credits × 2.0 (instant) × 1.0 (general) = 20 credits
  10 credits × 2.0 (instant) × 1.7 (engineer) = 34 credits
  5 credits × 2.0 (instant) × 1.5 (vibe coder) = 15 credits
```

**Usage Example:**

```typescript
// Simple question
{
  "message": "This authentication error keeps appearing. Can you identify the root cause?",
  "maxCredits": 10,
  "agentIdentifier": "Claude Code"
}

// With attachment
{
  "message": "The UI doesn't match the design. Can you review this screenshot?",
  "maxCredits": 5,
  "attachments": [{
    "fileName": "screenshot.png",
    "content": "base64EncodedImageData...",
    "mimeType": "image/png"
  }],
  "agentIdentifier": "Claude Code"
}

// With expert engineer
{
  "message": "Critical security vulnerability in OAuth implementation. Need expert review.",
  "maxCredits": 10,
  "tagId": 1,  // Engineer (expert level)
  "agentIdentifier": "Claude Code"
}
```

**Best Practices:**
1. Always include `agentIdentifier` for proper tracking
2. Be specific in your message - provide context and what you need
3. Choose appropriate `tagId` based on complexity (default to 5 for standard tasks)
4. Include error logs, stack traces, or screenshots as attachments when relevant
5. Set realistic `maxCredits` - simple questions need 3-5, complex ones need 8-10

**Common Errors & Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Not configured" | MCP not set up | Run `npx codevf setup` first |
| "maxCredits must be between 1 and 10" | Invalid credit range | Use 1-10 credits for instant mode |
| "Maximum 5 attachments allowed" | Too many files | Limit to 5 files or combine them |
| "File too large" | Attachment exceeds limits | Images/PDFs: max 10MB, text: max 1MB |

---

#### 💬 codevf-chat

**Purpose**: Start extended debugging sessions with real-time bidirectional communication with a human engineer.

**When to Use:**
- Complex bugs requiring multiple steps to diagnose
- Multi-step debugging sessions
- Architecture discussions
- Code review sessions requiring back-and-forth
- Tasks where engineer needs to ask clarifying questions

**When NOT to Use:**
- Simple one-off questions (use `codevf-instant` instead)
- Quick validations

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | ✅ Yes | Initial message or problem description |
| `maxCredits` | number | No | Maximum credits to spend (4-1920, default: 240) |
| `attachments` | array | No | File attachments (max 5 files: images, logs, PDFs) |
| `assignmentTimeoutSeconds` | number | No | Engineer assignment timeout (30-1800s, default: 300s) |
| `tagId` | number | No | Engineer expertise level (1=Engineer, 4=Vibe Coder, 5=General Purpose) |
| `continueTaskId` | string | No | Task ID to continue (when resuming) |
| `decision` | string | No | Handle active tasks: `override`, `followup`, or `reconnect` |
| `previouslyConnected` | boolean | No | Set true when reconnecting to skip greeting |
| `agentIdentifier` | string | ⚠️ Important | Your agent name for analytics |

**Cost Calculation:**

```
Formula: Final Credits = Base Credits × SLA Multiplier × Tag Multiplier

SLA Multiplier (chat mode): 2.0x
Tag Multipliers: Same as instant (1.7x, 1.5x, 1.0x)

Examples:
  30 minutes with General Purpose: 30 × 2.0 × 1.0 = 60 credits
  15 minutes with Engineer: 15 × 2.0 × 1.7 = 51 credits
  60 minutes with Vibe Coder: 60 × 2.0 × 1.5 = 180 credits
```

**🔴 CRITICAL: The Chat Loop Pattern**

`codevf-chat` requires you to maintain a loop. After EVERY engineer response, you MUST:

1. Execute the engineer's instructions
2. Call `codevf-chat` again with your results
3. Pass `continueTaskId` and `previouslyConnected: true`
4. Repeat until engineer says "COMPLETE", "FINISHED", or "ALL DONE"

**DO NOT:**
- Pass control back to the user mid-session
- Ask the customer questions during the loop
- Stop after one engineer response

**Usage Example:**

```typescript
// Initial chat session
{
  "message": "Complex authentication bug. Users randomly get logged out. I've checked session management, Redis config, and JWT implementation but can't find the issue.",
  "maxCredits": 120,
  "attachments": [{
    "fileName": "error.log",
    "content": "base64OrRawText...",
    "mimeType": "text/plain"
  }],
  "agentIdentifier": "Claude Code"
}

// Response: Engineer says "Check the middleware order in app.js"
// You investigate and find the issue, then IMMEDIATELY call:

{
  "message": "Found it! The auth middleware was running after the session middleware. I've reordered them. Here's the updated code: [code]. Can you verify this is correct?",
  "continueTaskId": "previous-task-id-from-first-response",
  "previouslyConnected": true,
  "agentIdentifier": "Claude Code"
}

// Continue this loop until engineer confirms task is complete
```

**Active Task Handling:**

When an active task exists, you'll receive:
```json
{
  "agentInstruction": "An active task exists. Ask user to choose.",
  "activeTask": { "id": "task-123", "message": "..." },
  "options": ["reconnect", "followup", "override"]
}
```

Then call again with `decision`:
- `reconnect`: Resume existing session without sending new message
- `followup`: Add message to existing session
- `override`: Close existing session and start new one

**Best Practices:**
1. Allocate sufficient credits (60-240) for complex sessions
2. Maintain the loop - keep calling until completion
3. Provide detailed context in initial message
4. Include relevant attachments upfront
5. Use `tagId: 1` for critical/complex issues
6. Always pass `previouslyConnected: true` when resuming

**Common Errors & Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| "maxCredits must be between 4 and 1920" | Invalid range | Use 4-1920 for chat mode (not 1-10) |
| "Timeout waiting for engineer response" | No response in 30 min | Session expired; start new chat |
| "WebSocket connection closed" | Connection lost | Automatically reconnects; continue with continueTaskId |

---

#### 🌐 codevf-tunnel

**Purpose**: Create secure tunnels to expose local development servers to the internet.

**When to Use:**
- Engineer needs to access your local dev server
- Testing webhooks from external services
- Debugging OAuth callbacks
- Sharing local previews with engineers
- Testing mobile app with local backend

**When NOT to Use:**
- Production deployments
- Permanent hosting
- When local server isn't running

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `port` | number | ✅ Yes | Local port to expose (1-65535, e.g., 3000) |
| `subdomain` | string | No | Custom subdomain (e.g., "myapp" → https://myapp.loca.lt) |
| `reason` | string | No | Description of why tunnel is needed |
| `agentIdentifier` | string | ⚠️ Important | Your agent name for analytics |

**Usage Example:**

```typescript
// Basic tunnel
{
  "port": 3000,
  "reason": "Engineer needs to test OAuth callback",
  "agentIdentifier": "Claude Code"
}

// With custom subdomain
{
  "port": 8080,
  "subdomain": "myapp-debug",
  "reason": "Sharing local API with engineer",
  "agentIdentifier": "Claude Code"
}
```

**Response Format:**
```
✅ Tunnel created successfully!

🔗 Tunnel URL: https://myapp.loca.lt
📍 Local Port: 3000
🔑 Password: [password]
⏰ Created: 2026-02-05T10:30:00.000Z

The tunnel will remain open for this session.
Engineers or external services can now access your local server at this URL.
```

**Best Practices:**
1. Ensure the local server is running before creating tunnel
2. Share the tunnel URL and password with the engineer
3. Tunnel remains active for the session - close when done
4. Use descriptive `reason` to track tunnel usage
5. Close unused tunnels to free resources

**Common Errors & Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid port" | Port out of range | Use 1-65535 |
| "Port may not be in use" | Local server not running | Start your dev server first |
| "Firewall blocking connections" | Network restriction | Check firewall settings |
| "Localtunnel service unavailable" | External service down | Retry in a few minutes |

---

#### 👂 codevf-listen

**Purpose**: Monitor active chat sessions in real-time (primarily for debugging/monitoring).

**Note**: This tool is less commonly used. Most agents will rely on the chat loop pattern rather than explicit monitoring.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | No | Specific session to monitor |
| `verbose` | boolean | No | Show detailed connection status |

**Usage Example:**

```typescript
// List active sessions
{
  "verbose": true
}

// Monitor specific session
{
  "sessionId": "session-123",
  "verbose": true
}
```

---

### 💰 Cost & Credit System

#### Base Rates
- **Instant Mode**: 1 credit ≈ 1 minute of engineer time
- **Chat Mode**: 2 credits ≈ 1 minute of engineer time (includes real-time WebSocket overhead)

#### SLA Multipliers
- **Instant**: 2.0x multiplier (priority response)
- **Chat**: 2.0x multiplier (real-time session)

#### Engineer Expertise Levels (tagId)

| tagId | Level | Multiplier | Best For | Cost Example (10 min instant) |
|-------|-------|------------|----------|-------------------------------|
| 1 | Engineer | 1.7x | Critical bugs, security issues, complex architecture, performance optimization | 10 × 2.0 × 1.7 = **34 credits** |
| 4 | Vibe Coder | 1.5x | Feature implementation, standard debugging, code reviews, refactoring | 10 × 2.0 × 1.5 = **30 credits** |
| 5 | General Purpose | 1.0x | Simple fixes, documentation, basic questions, general tasks | 10 × 2.0 × 1.0 = **20 credits** |

**Default**: If `tagId` is not specified, defaults to General Purpose (5, 1.0x multiplier).

**Choosing the Right Level:**
- Start with **General Purpose (5)** for most tasks
- Upgrade to **Vibe Coder (4)** for moderate complexity
- Use **Engineer (1)** only for critical/expert-level work

#### Cost Calculation Examples

```
Instant Query (Simple):
  5 minutes × 2.0 (instant) × 1.0 (general) = 10 credits

Instant Query (Expert):
  10 minutes × 2.0 (instant) × 1.7 (engineer) = 34 credits

Chat Session (Standard):
  30 minutes × 2.0 (chat) × 1.0 (general) = 60 credits

Chat Session (Complex):
  60 minutes × 2.0 (chat) × 1.5 (vibe coder) = 180 credits

Chat Session (Critical):
  45 minutes × 2.0 (chat) × 1.7 (engineer) = 153 credits
```

---

### ⚡ Best Practices

#### 1. Always Include agentIdentifier
```typescript
// ✅ Good
{ "message": "...", "agentIdentifier": "Claude Code" }

// ❌ Bad (will show as "Unknown" in analytics)
{ "message": "..." }
```

#### 2. Choose the Right Tool

| Scenario | Tool | Reason |
|----------|------|--------|
| "Does this fix work?" | instant | One-off validation |
| "What's this error?" | instant | Simple question |
| "Help debug OAuth flow" | chat | Multi-step process |
| "Review architecture design" | chat | Needs discussion |
| "Need to access localhost" | tunnel | Local server access |

#### 3. File Attachment Guidelines

**Supported Types:**
- Images: PNG, JPG, GIF (max 10MB, base64 encoded)
- PDFs: Documents, reports (max 10MB, base64 encoded)
- Text: Logs, configs, code (max 1MB, raw text)

**Best Practices:**
- Include error logs for debugging
- Attach screenshots for UI issues
- Provide config files when troubleshooting setup
- Limit to 5 most relevant files

**Encoding:**
```typescript
// Images and PDFs: base64
const imageBase64 = Buffer.from(imageBytes).toString('base64');

// Text files: raw text
const logContent = fs.readFileSync('error.log', 'utf8');
```

#### 4. Credit Allocation Strategy

| Task Complexity | Instant Credits | Chat Credits |
|----------------|-----------------|--------------|
| Simple question | 3-5 | N/A |
| Moderate question | 6-8 | N/A |
| Complex question | 9-10 | N/A |
| Simple debug session | N/A | 30-60 |
| Standard debug session | N/A | 60-120 |
| Complex investigation | N/A | 120-240 |
| Extended architecture discussion | N/A | 240-480 |

**Tip**: Start conservative, engineers will request more if needed.

#### 5. Error Handling

```typescript
// Always handle tool responses
const result = await callTool('codevf-instant', params);

if (result.isError) {
  // Check for common errors
  if (result.content[0].text.includes('Not configured')) {
    // Guide user to run setup
  } else if (result.content[0].text.includes('maxCredits')) {
    // Adjust credit parameters
  }
  // Handle error appropriately
}
```

#### 6. Session Management (Chat)

```typescript
// Track session state
let sessionState = {
  taskId: null,
  isActive: false,
  connected: false
};

// Initial call
const response1 = await callTool('codevf-chat', {
  message: "Problem description...",
  maxCredits: 120
});

// Extract taskId from response
sessionState.taskId = extractTaskId(response1);
sessionState.isActive = true;

// Continue loop
while (sessionState.isActive) {
  const engineerMessage = parseEngineerMessage(response);

  if (isSessionComplete(engineerMessage)) {
    sessionState.isActive = false;
    break;
  }

  const myResponse = executeInstructions(engineerMessage);

  // Call again with continueTaskId
  const nextResponse = await callTool('codevf-chat', {
    message: myResponse,
    continueTaskId: sessionState.taskId,
    previouslyConnected: true
  });
}
```

---

### 🔧 Troubleshooting

#### Active Task Conflicts

**Problem**: You receive a prompt about an active task when calling instant/chat.

**Solution**:
1. The tool will return options: `reconnect`, `followup`, or `override`
2. Decide based on context:
   - **reconnect**: Resume existing session without new message
   - **followup**: Add new message to existing session
   - **override**: Close existing, start new
3. Call the tool again with `decision` parameter

```typescript
// First call returns conflict
{
  "agentInstruction": "An active task exists. Ask user to choose.",
  "activeTask": { "id": "task-123", ... },
  "options": ["reconnect", "followup", "override"]
}

// Second call with decision
{
  "message": "My new message",
  "continueTaskId": "task-123",
  "decision": "followup",  // or "override" or "reconnect"
  "agentIdentifier": "Claude Code"
}
```

#### WebSocket Connection Issues

**Problem**: WebSocket disconnects during chat session.

**Solution**:
- The tool automatically attempts reconnection
- Continue calling with `continueTaskId` to resume
- If repeated disconnections, check network stability
- Consider restarting with new session if persistent

#### Timeout Errors

**Problem**: "Timeout waiting for engineer response"

**Causes & Solutions**:
- Engineer hasn't accepted (30 min timeout) → Increase `assignmentTimeoutSeconds` or retry
- No response after acceptance → Session expired, start new chat
- Network issues → Check connection and retry

#### Credit Errors

**Problem**: "Insufficient credits" or balance warnings

**Solution**:
- Check account balance
- Reduce `maxCredits` parameter
- Use lower `tagId` (General Purpose instead of Engineer)
- Consider task priority

#### File Upload Errors

**Problem**: Attachment upload fails

**Common Issues**:
- **File too large**: Reduce image quality or split logs
- **Invalid encoding**: Verify base64 for images/PDFs, raw text for logs
- **Wrong MIME type**: Use correct type (image/png, text/plain, application/pdf)
- **Too many files**: Limit to 5 most relevant files

---

### 📊 Decision Matrix: Which Tool to Use?

```
Need single response? → instant
Need back-and-forth? → chat

Simple question (< 5 min)? → instant
Complex investigation (> 15 min)? → chat

Need local server access? → tunnel (then instant or chat)

Monitoring session? → listen (rare, usually not needed)
```

---

### 🎯 Quick Start for AI Agents

**1. Simple Question**
```typescript
await callTool('codevf-instant', {
  message: "What's causing this error: [error details]?",
  maxCredits: 8,
  agentIdentifier: "Claude Code"
});
```

**2. Complex Debugging Session**
```typescript
// Initial
const response = await callTool('codevf-chat', {
  message: "Complex bug description with context...",
  maxCredits: 120,
  attachments: [{ fileName: "error.log", content: logContent, mimeType: "text/plain" }],
  agentIdentifier: "Claude Code"
});

// Extract taskId and loop
const taskId = extractTaskId(response);
while (!sessionComplete) {
  // Execute engineer's instructions
  const result = performWork(engineerInstructions);

  // Report back
  const nextResponse = await callTool('codevf-chat', {
    message: `Completed: ${result}`,
    continueTaskId: taskId,
    previouslyConnected: true,
    agentIdentifier: "Claude Code"
  });
}
```

**3. With Local Server Access**
```typescript
// First create tunnel
const tunnel = await callTool('codevf-tunnel', {
  port: 3000,
  reason: "Engineer needs to test OAuth",
  agentIdentifier: "Claude Code"
});

// Then start chat with tunnel URL
await callTool('codevf-chat', {
  message: `OAuth issue on local server. Tunnel: ${tunnelUrl}. Password: ${password}`,
  maxCredits: 90,
  agentIdentifier: "Claude Code"
});
```

---

**End of MCP Tools Reference**
