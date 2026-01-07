export const commandContent = `---
description: Ask a CodeVF engineer for help with code validation, debugging, or technical questions
---

# CodeVF Engineer Assistance

Please help me with the following question or task by consulting a CodeVF engineer using the appropriate MCP tool:

**My request:**
{{PROMPT}}

---

**Available CodeVF Commands:**
- \`codevf setup\` - Configure MCP server for Claude Code
- \`codevf mcp stdio\` - Start MCP server over stdio
- \`codevf mcp http --port 3333\` - Start MCP server over HTTP/SSE
- \`codevf welcome\` - Show welcome/setup guide
- \`codevf login\` - Authenticate with CodeVF (disabled in beta)
- \`codevf logout\` - Clear local authentication (disabled in beta)
- \`codevf init\` - Initialize CodeVF in a project (disabled in beta)
- \`codevf sync\` - Sync local changes with CodeVF (disabled in beta)
- \`codevf fix <issue>\` - Start live debugging session (disabled in beta)
- \`codevf tasks\` - List open tasks (disabled in beta)
- \`codevf cvf-chat [project-id]\` - Join live chat session (disabled in beta)
- \`codevf cvf-listen\` - Monitor active chats (disabled in beta)

**Instructions for Claude:**

1. **Analyze the request** to determine which CodeVF tool is most appropriate:
   - Use \`codevf-instant\` for:
     - Quick validation questions (1-10 credits, ~2 min response)
     - "Does this fix work?"
     - "Is this approach correct?"
     - "Can you identify the error?"
     - UI/visual verification and feedback
     - Simple technical questions

   - Use \`codevf-chat\` for:
     - Complex debugging requiring back-and-forth (4-1920 credits, 2 credits/min)
     - Multi-step troubleshooting
     - Architecture discussions
     - Extended collaboration

   - Use \`codevf-tunnel\` for:
     - Creating secure tunnels to expose local dev servers
     - Testing webhooks, OAuth callbacks, or external integrations
     - Sharing local development environment with engineers
     - No credits required - tunnel remains active for session

2. **For UI/Visual Development Tasks** (Pain-Free Experience):

   When implementing UI changes or visual features, follow this iterative flow:

   **Step 1 - Initial Implementation:**
   - Make the requested changes to code/styles
   - Create tunnel if needed: \`codevf-tunnel\` with dev server port
   - Share tunnel URL for visual verification

   **Step 2 - Engineer Verification:**
   - Use \`codevf-instant\` with message like:
     "Please verify this UI change via [tunnel-url] (password: [password]). Does it match the requested design/functionality?"
   - **Always include both URL and password** - localtunnel requires password to bypass landing page
   - Include specific areas of focus (layout, spacing, colors, interactions)
   - Allow 5-8 credits for visual review and feedback

   **Step 3 - Iterative Refinement:**
   - Apply engineer feedback immediately
   - Use \`codevf-instant\` again for re-verification:
     "Applied your feedback (reduced padding to 16px). Please check if this looks better now at [tunnel-url] (same password)."
   - Continue this cycle until engineer confirms it looks right
   - Each feedback cycle: 3-5 credits

   **Example UI Flow:**
   \`\`\`
   User: "Make the UI look like a modern card layout"

   Claude:
   1. Implements card styling
   2. Creates tunnel → https://abc123.loca.lt (password: xyz789)
   3. codevf-instant: "Please review the card layout at https://abc123.loca.lt
      (password: xyz789). Does it look modern and clean? Any spacing/styling issues?" (5 credits)

   Engineer: "Cards look good but margins are too large, reduce to 16px"

   Claude:
   4. Updates margins to 16px
   5. codevf-instant: "Applied 16px margins. Please verify the spacing
      looks better now at https://abc123.loca.lt (password: xyz789)." (3 credits)

   Engineer: "Perfect! The spacing looks much cleaner now."
   \`\`\`

3. **Use the appropriate tool:**
   - For instant queries: Call \`codevf-instant\` with the message and appropriate maxCredits (1-10)
   - For extended sessions: Call \`codevf-chat\` with the message and appropriate maxCredits (suggest 240 for ~2 hours)
   - For tunnel access: Call \`codevf-tunnel\` with the port number (e.g., { "port": 3000 })

4. **Present the response:**
   - For instant queries: Share the engineer's response directly
   - For chat sessions: Provide the session URL so the user can monitor the conversation
   - For tunnels: Share the public URL that was created

**Credit Guidelines:**
- Instant validation: 1-10 credits (typically 3-5 credits per question)
- UI verification: 5-8 credits for initial review, 3-5 credits for follow-up checks
- Extended chat: 2 credits per minute (240 credits = 2 hours)
- Tunnel creation: Free (no credits required)

**Planning Integration for Complex Tasks:**
When Claude is planning multi-step implementations, especially UI-heavy tasks:
- Always include "Engineer verification checkpoints" in the plan
- Budget credits for iterative feedback (typically 15-25 credits total for UI refinement)
- Create tunnel early in the process for continuous visual validation
- Plan for 2-4 feedback cycles to achieve the desired result

**Example Usage:**
- \`/cvf Does this authentication fix prevent the timing attack?\` → Use codevf-instant
- \`/cvf Complex race condition in WebSocket reconnection needs debugging\` → Use codevf-chat
- \`/cvf Create tunnel to my dev server on port 3000\` → Use codevf-tunnel
- \`/cvf Make the login form look more modern and user-friendly\` → Use tunnel + iterative codevf-instant feedback
`;
