import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod";
import { authorizeAI, cancelAI, InsufficientCoinsError, insufficientCoinsResponse, settleAI } from "../_shared/wallet.ts";
import { PROVIDER_RATES } from "../_shared/pricing.ts";
import { requireUser, enforceRateLimit, OWNER_EMAIL } from "../_shared/requireAuth.ts";
import { createOpenAIResponsesCall } from "../_shared/openai-responses.ts";
import { getLovableAiGatewayResponseHeaders } from "../_shared/ai-run-id.ts";

const MODEL = "openai/gpt-6-astra";
const MAX_CHAPTER_WORDS = 4000;
const MIN_CHAPTER_WORDS = 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  storyId: z.string().uuid(),
  chapterIndex: z.number().int().nonnegative(),
  previousContext: z.string().optional(),
  rewriteInstructions: z.string().optional(),
});

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: getLovableAiGatewayResponseHeaders(headers, {
      ...corsHeaders,
      "Content-Type": "application/json",
    }),
  });
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function cleanProse(value: string) {
  return value
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const limited = await enforceRateLimit(req, auth.user, "story-rewrite-chapter", { limit: 24, windowSeconds: 300 });
  if (limited) return limited;

  let parsed: z.infer<typeof RequestSchema>;
  try {
    const result = RequestSchema.safeParse(await req.json());
    if (!result.success) return json({ error: "invalid_request", details: result.error.flatten().fieldErrors }, 400);
    parsed = result.data;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const { data: row, error: storyError } = await admin
    .from("user_media")
    .select("id, title, metadata")
    .eq("id", parsed.storyId)
    .eq("user_id", auth.user.id)
    .eq("media_type", "story")
    .maybeSingle();

  if (storyError) return json({ error: "story_lookup_failed" }, 500);
  if (!row) return json({ error: "story_not_found" }, 404);

  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const chapters = Array.isArray(metadata.chapters) ? metadata.chapters as Array<Record<string, unknown>> : [];
  const chapter = chapters[parsed.chapterIndex];
  if (!chapter) return json({ error: "chapter_not_found" }, 404);

  const original = typeof chapter.content === "string" ? chapter.content.trim() : "";
  if (!original) return json({ error: "chapter_is_empty" }, 400);

  const title = typeof chapter.title === "string" && chapter.title.trim()
    ? chapter.title.trim()
    : `Chapter ${parsed.chapterIndex + 1}`;
  const sourceWords = countWords(original);
  const previousContext = (parsed.previousContext ?? "").slice(-14_000);
  const instructions = (parsed.rewriteInstructions ?? "").slice(0, 4_000);
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "ai_not_configured" }, 500);

  let billingTransactionId: string | undefined;
  if (auth.user.email?.toLowerCase() !== OWNER_EMAIL) {
    try {
      const authorization = await authorizeAI(
        auth.user.id,
        `story-rewrite:${parsed.storyId}:${parsed.chapterIndex}:${crypto.randomUUID()}`,
        "story-rewrite-chapter",
        "lovable_ai",
        MODEL,
        PROVIDER_RATES.lovable_ai_gpt5_per_call,
        { story_id: parsed.storyId, chapter_index: parsed.chapterIndex, input_words: sourceWords },
      );
      billingTransactionId = authorization.transaction_id;
    } catch (error) {
      if (error instanceof InsufficientCoinsError) return insufficientCoinsResponse(error, corsHeaders);
      throw error;
    }
  }

  const system = `You are the senior novelist and continuity editor inside Oracle Lunar.
Rewrite one complete chapter of an existing action-comedy science-fiction novel.

NON-NEGOTIABLE RULES:
- Preserve the chapter's established events, characters, relationships, Australian voice, humour, and continuity.
- Fully dramatise the chapter with polished scenes, natural dialogue, action, sensory detail, and emotional consequence. Never summarize.
- Keep the prose original. Do not imitate, mention, or borrow protected characters, franchises, authors, or distinctive wording.
- Return only the chapter prose. Do not include notes, word counts, markdown fences, or a duplicate chapter heading.
- The complete result must be between ${MIN_CHAPTER_WORDS.toLocaleString()} and ${MAX_CHAPTER_WORDS.toLocaleString()} words. Never exceed ${MAX_CHAPTER_WORDS.toLocaleString()} words.
- End the chapter at a deliberate, complete beat. No placeholders, abrupt truncation, repeated paragraphs, or "to be continued".
- Correct grammar and spelling. Keep names, tense, point of view, facts, injuries, locations, and unresolved plot threads consistent.
- Write for clean audiobook narration and Kindle publication.`;

  const user = `BOOK: ${String(row.title ?? metadata.title ?? "Zero Protocol")}
AUTHOR: ${String(metadata.author ?? "Juzzy")}
GENRE: ${String(metadata.genre ?? "Action-comedy science fiction")}
PREMISE: ${String(metadata.premise ?? "")}
CHAPTER: ${title}
SOURCE LENGTH: ${sourceWords.toLocaleString()} words

CONTINUITY FROM REWRITTEN EARLIER CHAPTERS:
${previousContext || "This is the opening chapter."}

AUTHOR'S REWRITE INSTRUCTIONS:
${instructions || "Rewrite and fully polish the complete chapter while preserving its story."}

ORIGINAL CHAPTER — preserve all essential story events while rewriting the prose:
${original}

Write the complete replacement chapter now. Aim for 1,800–2,200 words. Finish the chapter within that range and never exceed 4,000 words.`;

  try {
    const { result, runIdFetch } = createOpenAIResponsesCall(req, apiKey, system, user);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let text = "";
        let pending = "";
        try {
          for await (const delta of result.textStream) {
            text += delta;
            pending += delta;
            if (pending.length >= 2_000) {
              controller.enqueue(encoder.encode(`${JSON.stringify({ type: "delta", delta: pending })}\n`));
              pending = "";
            }
          }

          if (pending) controller.enqueue(encoder.encode(`${JSON.stringify({ type: "delta", delta: pending })}\n`));

          text = cleanProse(text);
          const words = countWords(text);
          const runId = runIdFetch.getRunId();
          if (billingTransactionId) {
            await settleAI(
              billingTransactionId,
              PROVIDER_RATES.lovable_ai_gpt5_per_call,
              runId,
              [{ unit_type: "request", quantity: 1 }],
              { story_id: parsed.storyId, chapter_index: parsed.chapterIndex, input_words: sourceWords, output_words: words },
            );
            billingTransactionId = undefined;
          }

          if (!text || words < MIN_CHAPTER_WORDS || words > MAX_CHAPTER_WORDS) {
            controller.enqueue(encoder.encode(`${JSON.stringify({
              type: "error",
              error: "chapter_validation_failed",
              message: `The rewrite returned ${words.toLocaleString()} words; the safe range is ${MIN_CHAPTER_WORDS.toLocaleString()}–${MAX_CHAPTER_WORDS.toLocaleString()}. The saved book was not changed.`,
              wordCount: words,
            })}\n`));
          } else {
            controller.enqueue(encoder.encode(`${JSON.stringify({
              type: "done",
              chapterIndex: parsed.chapterIndex,
              title,
              content: text,
              wordCount: words,
              runId,
            })}\n`));
          }
        } catch (streamError) {
          if (billingTransactionId) await cancelAI(billingTransactionId, "rewrite_failed").catch(() => undefined);
          billingTransactionId = undefined;
          const status = typeof streamError === "object" && streamError !== null && "statusCode" in streamError
            ? Number((streamError as { statusCode?: unknown }).statusCode)
            : 500;
          const message = status === 402
            ? "Not enough Oracle Lunar AI credit is available to continue this rewrite. Add AI credit, then start the rewrite again; the saved book has not changed."
            : streamError instanceof Error ? streamError.message : "AI rewrite failed";
          controller.enqueue(encoder.encode(`${JSON.stringify({
            type: "error",
            error: status === 402 ? "payment_required" : "rewrite_failed",
            message,
          })}\n`));
        } finally {
          controller.close();
        }
      },
      async cancel() {
        if (billingTransactionId) await cancelAI(billingTransactionId, "client_cancelled").catch(() => undefined);
        billingTransactionId = undefined;
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    if (billingTransactionId) await cancelAI(billingTransactionId, "rewrite_failed").catch(() => undefined);
    if (error instanceof DOMException && error.name === "AbortError") return json({ error: "cancelled" }, 499);
    const status = typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : 500;
    const safeMessage = error instanceof Error ? error.message : "AI rewrite failed";
    if (status === 402 || status === 403 || status === 429 || status >= 500) {
      return json({ error: "ai_gateway_error", message: safeMessage }, status);
    }
    console.error("story-rewrite-chapter", error);
    return json({ error: "rewrite_failed", message: safeMessage }, status >= 400 ? status : 500);
  }
});