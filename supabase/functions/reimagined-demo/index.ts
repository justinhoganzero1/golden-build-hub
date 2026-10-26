import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.117.2/cors';
import { requireOwner } from '../_shared/requireAuth.ts';

const accounts = {
  manager: { email: 'it-demo@reimagined.online', name: 'IT team', claimId: null },
  alex: { email: 'alex-demo@reimagined.online', name: 'Alex Morgan', claimId: 'RI-1031' },
  sam: { email: 'sam-demo@reimagined.online', name: 'Sam Taylor', claimId: 'RI-1088' },
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const password = Deno.env.get('REIMAGINED_DEMO_PASSWORD');
    if (!url || !key || !anon || !password) return reply({ error: 'Demo sign-in is not ready.' }, 503);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    if (!body || !['setup', 'login'].includes(body.action) || Object.keys(body).some(k => !['action', 'account'].includes(k)) || (body.account !== undefined && !Object.hasOwn(accounts, body.account))) {
      return reply({ error: 'Invalid request' }, 400);
    }
    if (body.action === 'setup') {
      const auth = await requireOwner(req);
      if (auth.response) return auth.response;
      // Provision exactly once. Public login never creates accounts or changes entitlements.
      for (const [demoKey, account] of Object.entries(accounts)) {
      const existing = await admin.from('reimagined_demo_access').select('user_id').eq('demo_key', demoKey).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) continue;
      const created = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true });
      if (created.error || !created.data.user) throw created.error ?? new Error('Account creation failed');
      const id = created.data.user.id;
      // Standard signup triggers create membership; remove it for this restricted synthetic account.
      const removed = await admin.from('memberships').delete().eq('user_id', id);
      if (removed.error) throw removed.error;
      const wallet = await admin.from('wallet_balances').select('balance_cents').eq('user_id', id).maybeSingle();
      if (wallet.error || (wallet.data && wallet.data.balance_cents !== 0)) throw new Error('Demo wallet must be empty');
      if (account.claimId) {
        const claim = await admin.from('reimagined_worker_cases').insert({ claim_id: account.claimId, worker_user_id: id, worker_name: account.name, employer: demoKey === 'alex' ? 'Northline Logistics' : 'Harbour Engineering', injury: demoKey === 'alex' ? 'Shoulder strain' : 'Lower back injury', capacity: demoKey === 'alex' ? 'Light duties · 4 hours/day' : 'Modified duties · 6 hours/day', stage: demoKey === 'alex' ? 'Review' : 'Recovery' });
        if (claim.error) throw claim.error;
      }
      const access = await admin.from('reimagined_demo_access').insert({ user_id: id, demo_key: demoKey, account_kind: account.claimId ? 'worker' : 'manager', assigned_claim_id: account.claimId });
      if (access.error) throw access.error;
      }
      return reply({ ready: true });
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const limit = await admin.rpc('reimagined_login_allowed', { _ip_hash: hash });
    if (limit.error) return reply({ error: 'Sign-in safety check unavailable. Try again later.' }, 503);
    if (limit.data !== true) return reply({ error: 'Too many sign-in attempts. Try again in an hour.' }, 429);
    const demoKey = (body.account ?? 'manager') as keyof typeof accounts;
    const access = await admin.from('reimagined_demo_access').select('user_id').eq('enabled', true).eq('demo_key', demoKey).maybeSingle();
    if (access.error || !access.data) return reply({ error: 'The IT account is not ready yet.' }, 503);
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await client.auth.signInWithPassword({ email: accounts[demoKey].email, password });
    if (signed.error || !signed.data.session || signed.data.user?.id !== access.data.user_id) {
      return reply({ error: 'Demo sign-in failed. Please try again.' }, 503);
    }
    const role = await admin.rpc('has_role', { _user_id: access.data.user_id, _role: 'admin' });
    const membership = await admin.from('memberships').select('user_id').eq('user_id', access.data.user_id).limit(1);
    if (role.error || role.data === true || membership.error || membership.data?.length) {
      return reply({ error: 'Demo account isolation check failed.' }, 503);
    }
    return reply({ access_token: signed.data.session.access_token, refresh_token: signed.data.session.refresh_token });
  } catch {
    return reply({ error: 'Demo service unavailable. Please try again.' }, 500);
  }
});