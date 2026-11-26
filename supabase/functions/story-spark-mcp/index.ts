// Public, no-login MCP endpoint (owner chose public). Exposes only Story Spark; no member data.
import { storySpark } from "./spark.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-session-id, mcp-protocol-version, accept",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const TOOL = {
  name: "generate_story_spark",
  title: "Oracle Lunar Story Spark",
  description: "Generates an opening scene and character hook for a creative story, by Oracle Lunar (oraclelunar.com).",
  inputSchema: {
    type: "object",
    properties: {
      genre: { type: "string", description: "Story genre, e.g. sci-fi, romance, mystery" },
      characterName: { type: "string", description: "Main character's name" },
    },
    required: ["genre", "characterName"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function handle(msg: any) {
  const { id, method, params } = msg ?? {};
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (msg?.jsonrpc !== "2.0" || typeof method !== "string") return err(-32600, "Invalid request");
  if (id === undefined) return null; // notification
  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: params?.protocolVersion ?? "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "oracle-lunar-story-spark", title: "Oracle Lunar Story Spark", version: "1.0.0" },
        instructions: "Free creative story openers from Oracle Lunar (oraclelunar.com).",
      });
    case "ping": return ok({});
    case "tools/list": return ok({ tools: [TOOL] });
    case "tools/call": {
      if (params?.name !== TOOL.name) return err(-32602, "Unknown tool");
      const a = params?.arguments ?? {};
      if (typeof a.genre !== "string" || typeof a.characterName !== "string" || !a.genre.trim() || !a.characterName.trim())
        return ok({ isError: true, content: [{ type: "text", text: "genre and characterName are required text." }] });
      return ok({ content: [{ type: "text", text: storySpark(a.genre, a.characterName) }] });
    }
    default: return err(-32601, "Method not found");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ name: "Oracle Lunar Story Spark MCP", site: "https://oraclelunar.com", transport: "streamable-http (POST JSON-RPC)" });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  if (Array.isArray(body)) {
    const out = body.slice(0, 20).map(handle).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: cors });
  }
  const res = handle(body);
  return res ? json(res) : new Response(null, { status: 202, headers: cors });
});
