# Quick Start Guide

Get up and running with CodeVF CLI in 5 minutes.

## Installation

### From NPM (when published)
```bash
npm install -g codevf-cli
```

### From Source
```bash
git clone https://github.com/codevf/cli.git
cd cli
npm install
npm run build
npm link
```

## Basic Usage

### 1. Login
```bash
codevf login
```
This will open your browser for OAuth authentication.

### 2. Initialize Your Project
```bash
cd /path/to/your/project
codevf init
```

You'll be asked:
- Project type (auto-detected)
- Test command
- Build command
- Allowed AI tools
- Whether to upload code snapshot
- Whether to allow engineer access to `codevf` branch

### 3. Start a Debug Session
```bash
codevf fix "Users can't login after OAuth update"
```

You'll be connected to a vetted engineer in real-time. The engineer can:
- Chat with you
- Request to run commands (requires your approval)
- Request to view files (requires your approval)
- Request screenshare (optional)

**Example session:**
```
┌─────────────────────────────────────────────┐
│ CodeVF Live Session                         │
│ Engineer: Maria (ex-Google)                 │
│ Billing: 1 credit used • Press CTRL+C       │
├─────────────────────────────────────────────┤
│ [12:34] Maria: Hi! I see you're having      │
│              authentication issues...       │
│                                             │
│ [12:35] You: Yes, after the OAuth change    │
│                                             │
│ [12:36] Maria: Let me check your auth flow  │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Engineer requests to run: npm test      │ │
│ │ Allow? (y/n):                           │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

Press **CTRL+C** to end the session and rate the engineer.

### 4. Sync Your Changes
```bash
codevf sync
```

This syncs your latest commits with CodeVF so engineers can see your latest changes.

## Common Workflows

### Bug Fix Workflow
```bash
# 1. Work on your code
git add .
git commit -m "Attempted fix for auth bug"

# 2. Sync changes
codevf sync

# 3. Get help
codevf fix "Auth still failing on production"

# 4. Engineer helps debug in real-time
# 5. Rate the engineer when done
```

### New Feature Help
```bash
# 1. Start a session
codevf fix "Need to implement real-time notifications with WebSockets"

# 2. Engineer helps architect and implement
# 3. Sync your work as you go
codevf sync
```

## Security & Permissions

Every action an engineer takes requires your approval:

- **Commands**: Engineer sees output only if you approve
- **Files**: Engineer can only read files you share
- **Branch**: Engineers work in the `codevf` branch only
- **Code Upload**: Only if you opt-in during `init`

## Billing

- Billed per minute of active engineer time
- Credits displayed in real-time
- No charge for waiting time
- Rate engineer when done

## Configuration

### Project Config (`.codevf/config.json`)
```json
{
  "projectId": "uuid",
  "allowedTools": ["claude", "gemini"],
  "testCommand": "npm test",
  "buildCommand": "npm run build",
  "repoUploaded": true,
  "branchMode": "codevf",
  "createdAt": "2025-11-30T...",
  "version": "1"
}
```

### Auth Token (`~/.config/codevf/auth.json`)
- Stored securely with 0600 permissions
- Auto-refreshed when expired
- Never logged or exposed

## Troubleshooting

### "Not authenticated"
```bash
codevf login
```

### "No CodeVF project found"
```bash
codevf init
```

### "Not on codevf branch"
```bash
git checkout -b codevf
codevf sync
```

### Connection issues
Check your internet connection and firewall settings.

## Next Steps

- Read the [full documentation](https://docs.codevf.com)
- Join our [Discord community](https://discord.gg/codevf)
- Follow us on [Twitter](https://twitter.com/codevf)

## Support

- **Email**: support@codevf.com
- **Issues**: https://github.com/codevf/cli/issues
- **Docs**: https://docs.codevf.com
