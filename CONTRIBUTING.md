# Contributing to CodeVF CLI

Thank you for your interest in contributing to CodeVF CLI!

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/codevf/cli.git
cd cli
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Run in development mode:
```bash
npm run dev -- <command>
```

## Project Structure

```
src/
├── commands/       # CLI command implementations
│   ├── setup.ts
│   └── mcp.ts
├── modules/        # Core business logic
│   ├── auth.ts
│   ├── config.ts
│   ├── api.ts
│   ├── git.ts
│   ├── websocket.ts
│   └── permissions.ts
├── ui/             # Terminal UI components (Ink/React)
│   └── LiveSession.tsx
├── types/          # TypeScript type definitions
│   └── index.ts
├── utils/          # Utility functions
│   ├── errors.ts
│   ├── detect.ts
│   └── upload.ts
└── index.ts        # CLI entry point
```

## Code Style

- Use TypeScript for all new code
- Follow the existing code style (enforced by ESLint)
- Format code with Prettier: `npm run format`
- Run linter: `npm run lint`

## Testing

```bash
npm test
```

## Making Changes

1. Create a new branch:
```bash
git checkout -b feature/my-feature
```

2. Make your changes and commit:
```bash
git add .
git commit -m "feat: add new feature"
```

3. Push and create a pull request:
```bash
git push origin feature/my-feature
```

## Commit Message Convention

We follow conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Maintenance tasks

## Questions?

Open an issue or reach out to the team at dev@codevf.com
