// Voice AI Receptionist — admin console.
// One page, seven tabs: Setup · Agent · Knowledge · Hours · Booking · CRM Pipeline · Call Logs.
// Owner-only.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import PageShell from "@/components/PageShell";
import UniversalBackButton from "@/components/UniversalBackButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Plus, Phone, RefreshCw } from "lucide-react";

const SUPABASE_PROJECT_ID = "tpkpfkcnqdyrzpqdoqnp";
const fnUrl = (name: string) => `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${name}`;

const VoiceReceptionistAdminPage = () => {
  const [cfg, setCfg] = useState<any>(null);
  const [kb, setKb] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleAcct, setGoogleAcct] = useState<{ email: string | null } | null>(null);

  const loadGoogle = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setGoogleAcct(null);
    const { data } = await supabase.from("user_google_tokens").select("email").eq("user_id", u.user.id).maybeSingle();
    setGoogleAcct(data ? { email: data.email } : null);
  };

  const connectGoogle = async () => {
    const redirect_uri = `${window.location.origin}/oauth/google/callback`;
    const { data, error } = await supabase.functions.invoke("google-oauth-start", { body: { redirect_uri } });
    if (error || !(data as any)?.url) { toast.error(error?.message || "Could not start Google sign-in"); return; }
    window.location.href = (data as any).url;
  };

  const disconnectGoogle = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("user_google_tokens").delete().eq("user_id", u.user.id);
    setGoogleAcct(null);
    toast.success("Google Calendar disconnected");
  };

  const loadAll = async () => {
    setLoading(true);
    const [c, k, s, ct, cl] = await Promise.all([
      supabase.from("voice_agent_config").select("*").limit(1).maybeSingle(),
      supabase.from("voice_knowledge_items").select("*").order("priority", { ascending: false }),
      supabase.from("crm_pipeline_stages").select("*").order("position"),
      supabase.from("crm_contacts").select("*").order("last_contact_at", { ascending: false, nullsFirst: false }).limit(100),
      supabase.from("voice_call_logs").select("*").order("started_at", { ascending: false }).limit(50),
    ]);
    setCfg(c.data);
    setKb(k.data || []);
    setStages(s.data || []);
    setContacts(ct.data || []);
    setCalls(cl.data || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const saveCfg = async () => {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase.from("voice_agent_config").update({
      greeting: cfg.greeting, system_prompt: cfg.system_prompt, voice_id: cfg.voice_id,
      language: cfg.language, business_hours: cfg.business_hours, handoff_number: cfg.handoff_number,
      twilio_phone_number: cfg.twilio_phone_number, booking_duration_minutes: cfg.booking_duration_minutes,
      booking_calendar_id: cfg.booking_calendar_id, google_calendar_enabled: cfg.google_calendar_enabled,
      external_webhook_url: cfg.external_webhook_url, missed_call_sms: cfg.missed_call_sms,
      drip_24h_sms: cfg.drip_24h_sms, drip_72h_sms: cfg.drip_72h_sms,
      handoff_rules: cfg.handoff_rules, enabled: cfg.enabled,
    }).eq("id", cfg.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const addKb = async () => {
    const { data, error } = await supabase.from("voice_knowledge_items").insert({ question: "New question", answer: "Answer here", priority: 0 }).select().maybeSingle();
    if (error) return toast.error(error.message);
    setKb([data, ...kb]);
  };
  const updateKb = async (id: string, patch: any) => {
    setKb(kb.map((k) => k.id === id ? { ...k, ...patch } : k));
    await supabase.from("voice_knowledge_items").update(patch).eq("id", id);
  };
  const deleteKb = async (id: string) => {
    await supabase.from("voice_knowledge_items").delete().eq("id", id);
    setKb(kb.filter((k) => k.id !== id));
  };

  const moveContact = async (contactId: string, stageId: string) => {
    setContacts(contacts.map((c) => c.id === contactId ? { ...c, stage_id: stageId } : c));
    await supabase.from("crm_contacts").update({ stage_id: stageId }).eq("id", contactId);
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied"); };

  const webhooks = useMemo(() => ({
    voice: fnUrl("voice-receptionist-incoming"),
    status: fnUrl("voice-receptionist-status"),
    sms: fnUrl("voice-receptionist-sms-inbound"),
    book: fnUrl("voice-receptionist-book"),
    drip: fnUrl("voice-receptionist-drip-tick"),
  }), []);

  if (loading || !cfg) return (
    <PageShell title="Voice AI Receptionist" subtitle="Loading…"><UniversalBackButton /><div className="p-8 text-center">Loading…</div></PageShell>
  );

  const contactsByStage = (stageId: string) => contacts.filter((c) => c.stage_id === stageId);
  const unstagedContacts = contacts.filter((c) => !c.stage_id);

  return (
    <PageShell title="Voice AI Receptionist" subtitle="Real-phone AI agent · Calendar · CRM · Drip">
      <SEO title="Voice Receptionist Console — Oracle Lunar" description="Configure the AI receptionist." />
      <UniversalBackButton />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Phone className="h-6 w-6 text-amber-400" />
            <div>
              <div className="font-bold">Status: {cfg.enabled ? <Badge className="bg-emerald-500">LIVE</Badge> : <Badge variant="destructive">OFFLINE</Badge>}</div>
              <div className="text-xs text-muted-foreground">Number: {cfg.twilio_phone_number || "— not set —"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
            <Button onClick={saveCfg} disabled={saving}>{saving ? "Saving…" : "Save All Settings"}</Button>
            <Button variant="outline" size="icon" onClick={loadAll}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>

        <Tabs defaultValue="setup">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
            <TabsTrigger value="hours">Hours & Handoff</TabsTrigger>
            <TabsTrigger value="booking">Booking</TabsTrigger>
            <TabsTrigger value="crm">CRM Pipeline</TabsTrigger>
            <TabsTrigger value="logs">Call Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="setup">
            <Card>
              <CardHeader>
                <CardTitle>Twilio webhook setup</CardTitle>
                <CardDescription>Paste these URLs into your Twilio phone number's configuration. Voice → "A CALL COMES IN" + "CALL STATUS CHANGES". Messaging → "A MESSAGE COMES IN".</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Voice — incoming call (TwiML)", url: webhooks.voice },
                  { label: "Voice — status callback (missed-call detector)", url: webhooks.status },
                  { label: "Messaging — incoming SMS reply", url: webhooks.sms },
                  { label: "Booking endpoint (call from your code)", url: webhooks.book },
                  { label: "Drip tick (point cron every 5 min)", url: webhooks.drip },
                ].map(({ label, url }) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={url} className="font-mono text-xs" />
                      <Button size="icon" variant="outline" onClick={() => copy(url)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                <div className="space-y-2 pt-3 border-t">
                  <Label>Your Twilio phone number (E.164, e.g. +14155550123)</Label>
                  <Input value={cfg.twilio_phone_number || ""} onChange={(e) => setCfg({ ...cfg, twilio_phone_number: e.target.value })} placeholder="+1..." />
                  <p className="text-xs text-muted-foreground">This is the number callers dial. Required for SMS text-back to work.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent">
            <Card>
              <CardHeader><CardTitle>Agent persona</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Greeting (spoken first)</Label><Textarea value={cfg.greeting} onChange={(e) => setCfg({ ...cfg, greeting: e.target.value })} rows={2} /></div>
                <div><Label>System prompt (full behaviour)</Label><Textarea value={cfg.system_prompt} onChange={(e) => setCfg({ ...cfg, system_prompt: e.target.value })} rows={8} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Voice ID (ElevenLabs)</Label><Input value={cfg.voice_id} onChange={(e) => setCfg({ ...cfg, voice_id: e.target.value })} /></div>
                  <div><Label>Language</Label><Input value={cfg.language} onChange={(e) => setCfg({ ...cfg, language: e.target.value })} /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Knowledge base</CardTitle><CardDescription>Q&A pairs the agent uses to answer FAQs.</CardDescription></div>
                <Button onClick={addKb}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {kb.map((k) => (
                  <div key={k.id} className="border rounded p-3 space-y-2">
                    <Input value={k.question} onChange={(e) => updateKb(k.id, { question: e.target.value })} placeholder="Question" />
                    <Textarea value={k.answer} onChange={(e) => updateKb(k.id, { answer: e.target.value })} rows={2} placeholder="Answer" />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><Label className="text-xs">Priority</Label><Input type="number" value={k.priority} onChange={(e) => updateKb(k.id, { priority: parseInt(e.target.value || "0") })} className="w-20" /><Switch checked={k.active} onCheckedChange={(v) => updateKb(k.id, { active: v })} /><span className="text-xs">{k.active ? "Active" : "Off"}</span></div>
                      <Button size="icon" variant="ghost" onClick={() => deleteKb(k.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
                {kb.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No knowledge items yet. Add some so the agent can answer questions.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours">
            <Card>
              <CardHeader><CardTitle>Business hours & human handoff</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Business hours (JSON)</Label><Textarea value={JSON.stringify(cfg.business_hours, null, 2)} onChange={(e) => { try { setCfg({ ...cfg, business_hours: JSON.parse(e.target.value) }); } catch {} }} rows={10} className="font-mono text-xs" /></div>
                <div><Label>Handoff phone number (E.164)</Label><Input value={cfg.handoff_number || ""} onChange={(e) => setCfg({ ...cfg, handoff_number: e.target.value })} placeholder="+1..." /></div>
                <div><Label>Handoff rules (JSON array)</Label><Textarea value={JSON.stringify(cfg.handoff_rules, null, 2)} onChange={(e) => { try { setCfg({ ...cfg, handoff_rules: JSON.parse(e.target.value) }); } catch {} }} rows={6} className="font-mono text-xs" /></div>
                <div><Label>Missed-call text-back SMS</Label><Textarea value={cfg.missed_call_sms} onChange={(e) => setCfg({ ...cfg, missed_call_sms: e.target.value })} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>24h reactivation SMS</Label><Textarea value={cfg.drip_24h_sms} onChange={(e) => setCfg({ ...cfg, drip_24h_sms: e.target.value })} rows={3} /></div>
                  <div><Label>72h reactivation SMS</Label><Textarea value={cfg.drip_72h_sms} onChange={(e) => setCfg({ ...cfg, drip_72h_sms: e.target.value })} rows={3} /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="booking">
            <Card>
              <CardHeader><CardTitle>Booking & calendar sync</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Default duration (min)</Label><Input type="number" value={cfg.booking_duration_minutes} onChange={(e) => setCfg({ ...cfg, booking_duration_minutes: parseInt(e.target.value || "30") })} /></div>
                  <div><Label>Google Calendar ID</Label><Input value={cfg.booking_calendar_id || "primary"} onChange={(e) => setCfg({ ...cfg, booking_calendar_id: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={cfg.google_calendar_enabled} onCheckedChange={(v) => setCfg({ ...cfg, google_calendar_enabled: v })} /><Label>Mirror bookings to Google Calendar (requires Google Calendar connector linked)</Label></div>
                <div><Label>External webhook (Zapier / n8n / HighLevel inbound URL)</Label><Input value={cfg.external_webhook_url || ""} onChange={(e) => setCfg({ ...cfg, external_webhook_url: e.target.value })} placeholder="https://hooks.zapier.com/..." /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crm">
            <Card>
              <CardHeader><CardTitle>Pipeline ({contacts.length} contacts)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {stages.map((s) => (
                    <div key={s.id} className="rounded-lg border p-2 space-y-2 min-h-[300px]" style={{ borderColor: s.color }}>
                      <div className="font-bold text-sm" style={{ color: s.color }}>{s.name} <span className="text-xs text-muted-foreground">({contactsByStage(s.id).length})</span></div>
                      {contactsByStage(s.id).map((c) => (
                        <div key={c.id} className="rounded bg-card p-2 text-xs border cursor-pointer hover:border-amber-400" onClick={() => {
                          const next = prompt(`Move ${c.name || c.phone} to stage:\n${stages.map((st, i) => `${i+1}. ${st.name}`).join("\n")}`);
                          const idx = parseInt(next || "") - 1;
                          if (stages[idx]) moveContact(c.id, stages[idx].id);
                        }}>
                          <div className="font-semibold">{c.name || "(no name)"}</div>
                          <div className="text-muted-foreground">{c.phone}</div>
                          {c.last_contact_at && <div className="text-[10px] text-muted-foreground mt-1">{new Date(c.last_contact_at).toLocaleString()}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {unstagedContacts.length > 0 && (
                  <div className="mt-4 p-3 border rounded">
                    <div className="font-bold text-sm mb-2">Unstaged ({unstagedContacts.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {unstagedContacts.map((c) => (
                        <Badge key={c.id} variant="outline" className="cursor-pointer" onClick={() => stages[0] && moveContact(c.id, stages[0].id)}>
                          {c.name || c.phone} → {stages[0]?.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader><CardTitle>Recent calls ({calls.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {calls.map((c) => (
                  <details key={c.id} className="border rounded p-2 text-sm">
                    <summary className="cursor-pointer flex items-center justify-between">
                      <span>{c.from_number} → <span className="text-muted-foreground">{c.status}</span> · {c.duration_seconds}s · {c.intent || "—"}</span>
                      <span className="text-xs text-muted-foreground">{new Date(c.started_at).toLocaleString()}</span>
                    </summary>
                    <div className="mt-2 space-y-1">
                      {(c.transcript as any[] || []).map((t, i) => (
                        <div key={i} className="text-xs"><b className={t.role === "user" ? "text-amber-400" : "text-emerald-400"}>{t.role}:</b> {t.text}</div>
                      ))}
                      {c.outcome && <div className="text-xs mt-1 italic">Outcome: {c.outcome}</div>}
                      {c.recording_url && <a href={c.recording_url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline">Recording</a>}
                    </div>
                  </details>
                ))}
                {calls.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No calls yet — point your Twilio number at the webhooks and test.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </PageShell>
  );
};

export default VoiceReceptionistAdminPage;
