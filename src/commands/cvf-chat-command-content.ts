export const chatCommandContent = `---
description: Start an extended CodeVF engineer chat session with full context
---

# CodeVF Engineer Chat

Please start an extended debugging session with a CodeVF engineer using the \`codevf-chat\` MCP tool.

**Current context (include relevant logs, errors, and recent changes):**
{{PROMPT}}

---

**Instructions for Claude:**

1. Ask a short clarifying question if needed: "What's the issue?"
2. Call \`codevf-chat\` with:
   - \`message\`: include the user's issue and any gathered context
   - \`maxCredits\`: suggest 240 (or adjust if user specifies)
3. Return the engineer response or session link directly.
`;
