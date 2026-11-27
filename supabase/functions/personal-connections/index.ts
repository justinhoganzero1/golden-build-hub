import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.99.2/cors';
import { z } from 'npm:zod@3';
import { Client } from 'npm:@modelcontextprotocol/sdk@1.26.0/client/index.js';
import { StreamableHTTPClientTransport } from 'npm:@modelcontextprotocol/sdk@1.26.0/client/streamableHttp.js';
import { requireUser, enforceRateLimit } from '../_shared/requireAuth.ts';
import { encryptCredential, decryptCredential, isEncryptedCredential, loadPersonalKeys } from '../_shared/personalCredentials.ts';
import { validatePluginUrl, validateAuthHeader, requireApproval } from '../_shared/pluginSafety.ts';
import { callPersonalChat } from '../_shared/personalChat.ts';
import { installNoRepeatRule } from '../_shared/noRepeat.ts';
import { safePluginFetch } from './safeFetch.ts';
installNoRepeatRule();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const provider = z.enum(['openai','gemini','anthropic','elevenlabs','replicate','stability','resend','stripe','twilio']);
const pluginSchema = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(1000).default(''), kind: z.enum(['api','webhook','mcp']), endpoint: z.string().max(2048), auth_method: z.enum(['none','bearer','api_key']), auth_header: z.string().default('X-API-Key'), key: z.string().max(8192).optional() });
const AI_COLUMNS = { openai: 'openai_key', gemini: 'gemini_key', anthropic: 'claude_key' } as const;
async function migrateAccountCredentials(admin: any, userId: string) {
  const { data: row, error } = await admin.from('user_ai_keys').select('openai_key,gemini_key,claude_key').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Cannot read connections.');
  const patch: Record<string,string> = {};
  for (const column of Object.values(AI_COLUMNS)) if (row?.[column] && !isEncryptedCredential(row[column])) patch[column] = await encryptCredential(row[column], userId);
  if (Object.keys(patch).length) { const { error } = await admin.from('user_ai_keys').update(patch).eq('user_id', userId); if (error) throw new Error('Cannot secure connections.'); }
  const { data: rows } = await admin.from('user_connectors').select('provider,api_key').eq('user_id', userId);
  for (const r of rows ?? []) if (r.api_key && !isEncryptedCredential(r.api_key)) { const { error } = await admin.from('user_connectors').update({ api_key: await encryptCredential(r.api_key, userId) }).eq('user_id', userId).eq('provider', r.provider); if (error) throw new Error('Cannot secure connections.'); }
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Use POST.' },405);
  try {
    const auth = await requireUser(req); if (auth.response) return auth.response;
    const user = auth.user;
    const limited = await enforceRateLimit(req,user,'personal-connections',{ limit: 30, windowSeconds: 60 }); if (limited) return limited;
    const url = Deno.env.get('SUPABASE_URL'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !service) return json({ message: 'Connections are unavailable.' },503);
    const admin = createClient(url,service,{ auth: { persistSession: false } });
    if (Number(req.headers.get('content-length') ?? 0) > 24000) return json({ message: 'Request too large.' },413);
    const raw = await req.text(); if (raw.length > 24000) return json({ message: 'Request too large.' },413);
    const body = JSON.parse(raw); const action = z.string().parse(body.action);
    if (action === 'status') {
      await migrateAccountCredentials(admin,user.id);
      const keys = await loadPersonalKeys(admin,user.id);
      const { data: others, error } = await admin.from('user_connectors').select('provider,enabled,api_key').eq('user_id',user.id);
      if (error) throw new Error('Cannot load connections.');
      const providers = Object.entries(AI_COLUMNS).map(([id]) => ({ provider: id, connected: !!keys[id as keyof typeof keys] }));
      for (const row of others ?? []) if (!(row.provider in AI_COLUMNS)) providers.push({ provider: row.provider, connected: !!(row.enabled && row.api_key) });
      const { data: plugins, error: pluginError } = await admin.from('personal_plugins').select('id,name,description,kind,enabled,created_at').eq('user_id',user.id).order('created_at',{ ascending:false });
      if (pluginError) throw new Error('Cannot load plugins.');
      return json({ providers, preferred: keys.preferred, plugins: plugins ?? [] });
    }
    if (action === 'save_provider') {
      const id = provider.parse(body.provider); const key = z.string().trim().min(10).max(8192).parse(body.key);
      if (id === 'gemini') return json({ message: 'Connect Gemini through its consent steps.', fix_path: '/ai-key-setup' },400);
      if (id in AI_COLUMNS) {
        requireApproval(body.confirmed);
        const response = await callPersonalChat(id as 'openai'|'anthropic',key,[{role:'user',content:'Reply with OK.'}],false,8);
        await response.body?.cancel();
        if (!response.ok) return json({ message: `Key check failed (${response.status}). Nothing was saved.` },400);
        const { error } = await admin.from('user_ai_keys').upsert({ user_id:user.id,[AI_COLUMNS[id as keyof typeof AI_COLUMNS]]:await encryptCredential(key,user.id),updated_at:new Date().toISOString() },{onConflict:'user_id'});
        if (error) throw new Error('Cannot save key.');
      } else {
        const { error } = await admin.from('user_connectors').upsert({user_id:user.id,provider:id,api_key:await encryptCredential(key,user.id),enabled:true,updated_at:new Date().toISOString()},{onConflict:'user_id,provider'});
        if (error) throw new Error('Cannot save connection.');
      }
      return json({ok:true});
    }
    if (action === 'remove_provider') {
      const id = provider.parse(body.provider);
      const result = id in AI_COLUMNS ? await admin.from('user_ai_keys').update({[AI_COLUMNS[id as keyof typeof AI_COLUMNS]]:null}).eq('user_id',user.id) : await admin.from('user_connectors').delete().eq('user_id',user.id).eq('provider',id);
      if (result.error) throw new Error('Cannot disconnect.');
      // Delete the older parallel AI connector too, so removal cannot leave an active duplicate.
      if (id in AI_COLUMNS) await admin.from('user_connectors').delete().eq('user_id',user.id).eq('provider',id);
      return json({ok:true});
    }
    if (action === 'select_provider') {
      const chosen = z.enum(['auto','gemini','openai','anthropic']).parse(body.provider);
      const keys = await loadPersonalKeys(admin,user.id);
      if (chosen !== 'auto' && !keys[chosen]) return json({ message:'Connect this provider first.' },400);
      const { error } = await admin.from('user_ai_keys').upsert({user_id:user.id,preferred_provider:chosen},{onConflict:'user_id'});
      if (error) throw new Error('Cannot save AI selection.');
      return json({ok:true});
    }
    if (action === 'save_plugin') {
      const p = pluginSchema.parse(body.plugin); validatePluginUrl(p.endpoint); validateAuthHeader(p.auth_header);
      if (p.auth_method !== 'none' && !p.key?.trim()) return json({ message:'An authentication key is required.' },400);
      const { error } = await admin.from('personal_plugins').insert({user_id:user.id,name:p.name,description:p.description,kind:p.kind,endpoint_ciphertext:await encryptCredential(p.endpoint,user.id),auth_method:p.auth_method,auth_header:p.auth_header,key_ciphertext:p.key ? await encryptCredential(p.key,user.id):null});
      if (error) throw new Error('Cannot save plugin.');
      return json({ok:true});
    }
    const id = z.string().uuid().parse(body.id);
    const { data: plugin, error } = await admin.from('personal_plugins').select('*').eq('user_id',user.id).eq('id',id).maybeSingle();
    if (error || !plugin) return json({message:'Plugin not found.'},404);
    if (action === 'delete_plugin') { const {error} = await admin.from('personal_plugins').delete().eq('user_id',user.id).eq('id',id); if(error) throw new Error('Cannot delete plugin.'); return json({ok:true}); }
    if (action === 'toggle_plugin') { const {error} = await admin.from('personal_plugins').update({enabled:z.boolean().parse(body.enabled)}).eq('user_id',user.id).eq('id',id); if(error) throw new Error('Cannot change plugin.'); return json({ok:true}); }
    if (!['discover','run'].includes(action)) return json({message:'Unknown action.'},400);
    requireApproval(body.confirmed);
    if (!plugin.enabled) return json({message:'This plugin is switched off.'},409);
    const endpoint = await decryptCredential(plugin.endpoint_ciphertext,user.id); if(!endpoint) throw new Error('Missing plugin address.');
    const key = await decryptCredential(plugin.key_ciphertext,user.id);
    const headers: Record<string,string> = {};
    if(key && plugin.auth_method === 'bearer') headers.Authorization = `Bearer ${key}`;
    if(key && plugin.auth_method === 'api_key') headers[validateAuthHeader(plugin.auth_header)] = key;
    const requestId = z.string().uuid().parse(body.request_id);
    const {error: claimError} = await admin.from('personal_plugin_runs').insert({id:requestId,user_id:user.id,plugin_id:id});
    if(claimError) return json({message:'This request has already started. Check the service; it will not be replayed.'},409);
    let result: unknown; let client: Client | undefined;
    try {
      if(plugin.kind === 'mcp') {
        client = new Client({name:'oracle-lunar',version:'1.0.0'},{capabilities:{}});
        const transport = new StreamableHTTPClientTransport(new URL(endpoint),{requestInit:{headers},fetch:safePluginFetch});
        await client.connect(transport);
        if(action === 'discover') {
          const tools = await client.listTools();
          result = {tools:tools.tools.slice(0,100).map(t=>({name:t.name,description:t.description?.slice(0,1000),inputSchema:t.inputSchema})),has_more:!!tools.nextCursor};
        } else {
          const tool = z.string().min(1).max(128).parse(body.tool);
          const args = z.record(z.unknown()).parse(body.arguments ?? {});
          result = await client.callTool({name:tool,arguments:args});
        }
      } else {
        if(action === 'discover') throw new Error('Tool discovery is for MCP connections only.');
        const input = z.record(z.unknown()).parse(body.arguments ?? {});
        const response = await safePluginFetch(endpoint,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(input)});
        if(!response.ok) throw new Error(`Plugin returned ${response.status}. Its action may have run; check the service before retrying.`);
        result = await response.text();
      }
      const text = typeof result === 'string' ? result : JSON.stringify(result);
      if(text.length > 100000) throw new Error('Plugin result is too large.');
      // Defense in depth: never echo the stored token or credential-bearing endpoint.
      let safe = text.replaceAll(endpoint,'[private connection address]'); if(key) safe = safe.replaceAll(key,'[private credential]');
      const {error} = await admin.from('personal_plugin_runs').update({status:'completed',result:safe}).eq('id',requestId).eq('user_id',user.id);
      if(error) throw new Error('Result could not be recorded. Check the service before retrying.');
      return json({ok:true,result:safe});
    } catch(e) {
      await admin.from('personal_plugin_runs').update({status:'uncertain'}).eq('id',requestId).eq('user_id',user.id);
      throw e;
    } finally { await client?.close().catch(()=>{}); }
  } catch(e) {
    if(e instanceof z.ZodError) return json({message:'Check the connection details and request fields.'},400);
    // Error messages are controlled locally; SDK/upstream error objects can contain private URLs.
    const text = e instanceof Error ? e.message : '';
    const safe = /^(Use a public|Private network|Approve this|Choose a safe|Connection address|Connect this|Cannot |Unable |Plugin (?:returned|response|redirects|timed out|connection|result)|The plugin must|Tool discovery|Missing plugin|Result could)/.test(text) ? text : 'Connection failed. Check the service before trying again; nothing will be replayed automatically.';
    return json({message:safe},400);
  }
});
