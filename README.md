# CodeVF CLI

**⚠️ BETA:** Live debugging with vetted engineers, right from your terminal.

## Installation

```bash
npm install -g codevf-cli
```

## Quick Start

```bash
# Authenticate
codevf login

# Initialize your project
codevf init

# Start a live debugging session (interactive)
codevf

# Or provide issue directly
codevf fix "Users can't login after OAuth update"

# Auto-create a tunnel when starting a session
codevf fix "Debug OAuth callback" --tunnel 3000

# Sync your code changes
codevf sync

# Share a local port with your engineer (during a session)
# In the chat UI:
# /tunnel 3000
```

## Commands

### `codevf login`
Authenticate with CodeVF using OAuth.

### `codevf logout`
Clear local authentication.

### `codevf init`
Initialize CodeVF in your project. Sets up:
- Project configuration
- Test and build commands
- AI tool preferences
- Optional code upload for faster debugging

### `codevf` or `codevf fix "<issue description>"`
Start a live debugging session with a vetted engineer:
- Just type `codevf` and you'll be prompted to describe your issue
- Or use `codevf fix "issue"` to provide it directly
- Real-time chat in your terminal
- Engineer can request to run commands (with your approval)
- Engineer can request to view files (with your approval)
- Securely share a local port over the internet with `/tunnel <port>` when asked
- Track credit usage in real-time
- Rate the engineer when done

### `codevf sync`
Sync your local changes to the `codevf` branch for engineer access.

## How It Works

1. **You have a bug** - Start a session with `codevf fix "description"`
2. **Get matched with an engineer** - Ex-FAANG engineers with expertise in your stack
3. **Collaborate safely** - Engineer can only run commands and view files with your approval
4. **Get it fixed** - Engineer works in real-time to solve your issue
5. **Pay per minute** - Only pay for active debugging time

## Security & Privacy

- Engineers can only access your code with explicit permission
- All commands require approval before execution
- File access is granted on a per-file basis
- All actions are logged and auditable
- Engineers work in a restricted `codevf` Git branch
- Your code is never stored without your consent

## Configuration

After running `codevf init`, configuration is stored in `.codevf/config.json`:

```json
{
  "projectId": "uuid",
  "allowedTools": ["claude", "gemini"],
  "testCommand": "npm test",
  "buildCommand": "npm run build",
  "repoUploaded": true,
  "branchMode": "codevf"
}
```

## Requirements

- Node.js 18 or higher
- Git (for sync command)
- Internet connection

## Support

- Documentation: https://docs.codevf.com
- Issues: https://github.com/codevf/cli/issues
- Email: support@codevf.com

## License

Commercial license — see `LICENSE`. Use is limited to interacting with CodeVF services; no redistribution or competing uses.
