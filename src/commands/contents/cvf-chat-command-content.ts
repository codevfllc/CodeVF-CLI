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
3. **IMPORTANT: Every time you successfully execute a command, run a task, or complete an action**, immediately call \`codevf-chat\` again with a JSON thought process in this format:
   \`\`\`json
   {
     "type": "thought_process",
     "action": "brief description of what was done",
     "status": "success|in_progress|error",
     "result": "what happened and outcome",
     "next_step": "what to do next"
   }
   \`\`\`
   Include this JSON in your message to the engineer. Example: "Executed command \\\`npm install\\\`. \`\`\`json {\"type\": \"thought_process\", \"action\": \"install dependencies\", \"status\": \"success\", \"result\": \"All packages installed\", \"next_step\": \"Run the dev server\"} \`\`\`"

4. **When running commands that produce output**, redirect the output of the logs to \`logs.txt\` so the engineer can review results. For example:
   - \`bun dev > logs.txt\`
   - \`npm run dev > logs.txt\`
   - \`npm test > logs.txt\`
   - \`node script.js > logs.txt\`
   
   Always use the filename \`logs.txt\` for consistency.

5. **IMPORTANT: Whenever the user requests the server to be up** (e.g., "start the dev server", "run the server", "get the app running", etc.), you MUST also start log streaming immediately after. Run one of these commands in a separate process:
   - \`codevf watch-logs <task-id>\`
   - \`bun x codevf watch-logs <task-id>\` (if codevf is not installed globally)
   - \`npx codevf watch-logs <task-id>\` (if needed)
   
   Replace \`<task-id>\` with the actual task ID. This ensures the engineer sees all logs from the running server in real-time. Start this in a background process or separate terminal so it doesn't block the server from running.

6. **When sending files to the engineer**, format your message as JSON in this structure:
   \`\`\`json
   {
     "type": "file_message",
     "message": "Brief description of what this file is or why you're sending it",
     "file": {
       "name": "filename.ext",
       "path": "relative/path/to/file",
       "content": "file content here (can be large)"
     }
   }
   \`\`\`
   The frontend will automatically detect this JSON structure and render the file as a badge with the ability to open the content in a dialog with markdown rendering. Example: \`\`\`json {\"type\": \"file_message\", \"message\": \"Here's the error log for debugging:\", \"file\": {\"name\": \"error.log\", \"path\": \"logs/error.log\", \"content\": \"[ERROR] Connection failed...\"}} \`\`\`
7. Return the engineer response or session link directly.

**Notes:** 
- The engineer interface will render thought process JSON blocks as formatted thought processes to help track progress
- File message JSON blocks will be detected and rendered as interactive file badges with dialog viewers
- Keep JSON formatting consistent - use valid JSON within markdown code blocks
`;
