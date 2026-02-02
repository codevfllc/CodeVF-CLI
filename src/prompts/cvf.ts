export const commandContent = `---
description: Use CodeVF MCP to implement a fix, then verify with an engineer (retry if needed)
---

# CodeVF MCP Fix + Verify

Please handle the request end-to-end using CodeVF MCP tools. Prefer action over explanation.

**User request:**
{{PROMPT}}

---

**Available CodeVF Commands:**
- \`npx codevf setup\` - Configure MCP server for Claude Code, Codex, and Gemini
- \`codevf mcp stdio\` - Start MCP server over stdio
- \`codevf mcp http --port 3333\` - Start MCP server over HTTP/SSE

**Primary workflow (do this by default):**
1. **Clarify quickly if needed** (1-2 short questions) to get repro, expected behavior, or environment.
2. **Attempt the fix locally** (edit code, run tests, or reason through the change).
3. **Verify with a CodeVF engineer**:
   - Prefer \`codevf-instant\` whenever possible.
   - If verification needs a running app or UI review, **ensure the HTTP dev server is running and reachable**, then create a tunnel with \`codevf-tunnel\`.
   - When using a tunnel, include both URL and password in the engineer request.
4. **Retry based on feedback**:
   - Apply engineer feedback and re-verify.
   - Limit to **max 3 verification cycles** unless the user asks to continue.
5. **Escalate when needed**:
   - If the issue is complex, unclear, or requires back-and-forth, start \`codevf-chat\`.
6. **Vibe-code mode (default for most cases):**
   - Iterate with the CodeVF engineer instead of the user to one-shot the solution.
   - Use \`codevf-chat\` to drive rapid back-and-forth until a solid solution is reached.
   - Only ask the user if you are blocked by missing critical info.

**Tool selection:**
- \`codevf-instant\`: quick validation, visual checks, "does this fix work?" (preferred)
- \`codevf-chat\`: complex debugging, multi-step investigation
- \`codevf-tunnel\`: expose local dev server for verification (UI/behavioral checks)

**Verification message checklist (include in engineer request):**
- Goal of verification (what should be true)
- Steps to reproduce/check
- Areas of focus (UI layout, API response, edge cases)
- Expected outcome
- Tunnel URL + password (if used)

**Verification message template (use this shape):**
"Please verify the fix via [tunnel-url] (password: [password]). Checklist: Goal=[...], Steps=[...], Focus=[...], Expected=[...]."

**Output to the user:**
- Provide what changed and what was verified
- Include engineer feedback and any remaining risks
`;

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

export const perfCommandContent = `---
description: Get performance-focused review or optimization guidance from a CodeVF engineer
---

# CodeVF Performance Review

Please help me improve performance by consulting a CodeVF engineer using the appropriate MCP tool.

**Current context (include benchmarks, profiler output, metrics, and hot paths):**
{{PROMPT}}

---

**Instructions for Claude:**

1. **Clarify the goal** quickly if needed:
   - Target metric (latency, throughput, memory, CPU, bundle size)
   - Expected vs current numbers
   - Environment (prod/dev, hardware, dataset size)

2. **Pick the right tool:**
   - Use \`codevf-instant\` for:
     - Single bottleneck checks
     - Quick sanity check on a proposed optimization
     - Small profiling/benchmark interpretation
   - Use \`codevf-chat\` for:
     - Multi-step profiling/measurement plans
     - Architecture or algorithm changes
     - End-to-end tuning across layers

3. **Provide actionable context to the engineer:**
   - Exact code paths or files
   - Repro steps and dataset sizes
   - Any profiling data or flamegraphs
   - Deployment/runtime constraints

4. **Ask for measurable outcomes:**
   - Request concrete steps and expected impact
   - Ask for validation approach (before/after metrics)
`;
