export type PersonalProvider = 'openai' | 'gemini' | 'anthropic';
export const PERSONAL_MODELS = { openai: 'gpt-4o-mini', gemini: 'gemini-flash-lite-latest', anthropic: 'claude-sonnet-4-5' } as const;
export function personalRequest(provider: PersonalProvider, key: string, messages: any[], stream = true, maxTokens = 900) {
  if (provider !== 'anthropic') return { url: provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: { model: PERSONAL_MODELS[provider], messages, stream, max_tokens: maxTokens } };
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const converted = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: Array.isArray(m.content) ? m.content.map((part: any) => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    const image = String(part.image_url?.url ?? '');
    const match = image.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (!match) throw new Error('Claude requires an attached image, not an external picture address.');
    return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
  }) : m.content }));
  return { url: 'https://api.anthropic.com/v1/messages', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: { model: PERSONAL_MODELS.anthropic, system, messages: converted, stream, max_tokens: maxTokens } };
}
export function anthropicDelta(event: any): string | null {
  if (event.type === 'error') throw new Error('Claude stopped answering. Please retry explicitly.');
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') return `data: ${JSON.stringify({ choices: [{ delta: { content: event.delta.text } }] })}\n\n`;
  if (event.type === 'message_stop') return 'data: [DONE]\n\n';
  return null;
}
export function normalizeClaudeStream(response: Response): Response {
  let buffer = '';
  const decoder = new TextDecoder(); const encoder = new TextEncoder();
  const transform = new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
    for (const line of lines) if (line.startsWith('data: ')) { const out = anthropicDelta(JSON.parse(line.slice(6))); if (out) controller.enqueue(encoder.encode(out)); }
  }, flush(controller) { if (buffer.startsWith('data: ')) { const out = anthropicDelta(JSON.parse(buffer.slice(6))); if (out) controller.enqueue(encoder.encode(out)); } } });
  return new Response(response.body?.pipeThrough(transform), { status: response.status, headers: { 'Content-Type': 'text/event-stream' } });
}
export async function callPersonalChat(provider: PersonalProvider, key: string, messages: any[], stream = true, maxTokens = 900) {
  const request = personalRequest(provider, key, messages, stream, maxTokens);
  const response = await fetch(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(request.body), signal: AbortSignal.timeout(30000) });
  return provider === 'anthropic' && stream && response.ok ? normalizeClaudeStream(response) : response;
}
