import { defineTool } from "@lovable.dev/mcp-js";
import { mcpOk, notAuthenticated } from "../lib/errors";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in Oracle Lunar user (id and email) for the current MCP session.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    return mcpOk({ user_id: ctx.getUserId(), email: ctx.getUserEmail() });
  },
});
