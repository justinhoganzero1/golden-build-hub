
# Voice AI Receptionist — Live Build Plan

Adds a new module to Oracle Lunar that answers a real phone number with an AI agent, books appointments to both Oracle Calendar and Google Calendar, fires text-back SMS on missed calls, and pushes every call into a built-in CRM pipeline with tags, follow-ups, and tasks.

## What will be live in your app

1. **Voice AI agent** — Twilio phone number → TwiML webhook → Gemini-powered agent that greets, handles FAQs, qualifies the caller, books appointments, and hands off to a human when rules trigger. Speech: Twilio `<Gather input="speech">` + ElevenLabs TTS streamed back via `<Play>`.
2. **Admin console** (`/admin/voice-receptionist`) — edit the agent's prompt, knowledge base (FAQs Q&A list), business hours, languages, voice, handoff number, booking calendar, and pipeline mapping.
3. **Booking rules + handoff** — JSON rules (e.g. "if intent=complaint OR value>$5k → transfer to +614..."). Booked slots check both calendars for conflicts.
4. **Missed-call text-back** — Twilio `status_callback` detects `no-answer`/`busy`/`failed` and fires an SMS within seconds, plus a 24h + 72h reactivation drip if no reply.
5. **CRM pipeline** — every call creates a `crm_contact` + `crm_activity`; agent can tag, advance pipeline stage, schedule a follow-up task, queue an SMS/email, and POST to an external webhook (Zapier/n8n/HighLevel-compatible) so it "feeds your whole system."

## Capability tiles on the new module page

Re-uses the screenshot's 5-tile layout, styled to Oracle Lunar (dark + amber), each tile linking to its live admin section.

## Architecture (technical)

```text
 Caller dials Twilio number
        │
        ▼
 Twilio Voice  ──webhook──►  edge: voice-receptionist-incoming  (TwiML)
        │                              │
        │                              ├─ Gemini reply via Lovable AI Gateway
        │                              ├─ ElevenLabs TTS (existing key)
        │                              └─ <Gather speech> loop until intent resolved
        │
        ├──status_callback──► edge: voice-receptionist-status
        │                              └─ if missed → SMS text-back + drip enqueue
        │
        └──on "book"──► edge: voice-receptionist-book
                                      ├─ insert into calendar_events (Oracle)
                                      ├─ Google Calendar connector insert
                                      └─ crm_activity + pipeline advance
```

### New edge functions
- `voice-receptionist-incoming` — TwiML answer + speech-to-text loop + AI response.
- `voice-receptionist-status` — missed-call detector + SMS firing + drip scheduler.
- `voice-receptionist-book` — slot conflict check (Oracle + Google) + dual-write.
- `voice-receptionist-sms-inbound` — inbound SMS replies into the CRM thread.
- `voice-receptionist-drip-tick` — cron every 5 min, sends scheduled follow-ups.
- `voice-receptionist-webhook-fanout` — POSTs CRM events to external URL when set.

### New tables (with RLS + GRANTs)
- `voice_agent_config` (owner-only) — single row: prompt, voice_id, greeting, business_hours JSON, handoff_number, fallback_number, booking_calendar_ids, external_webhook_url.
- `voice_knowledge_items` — Q&A pairs, embeddings optional.
- `voice_call_logs` — call_sid, from, to, duration, transcript, intent, outcome, recording_url.
- `crm_contacts` — phone, name, email, tags[], stage, owner_id, last_contact_at.
- `crm_activities` — contact_id, type (call/sms/email/note/task/book), payload, occurs_at, status.
- `crm_pipeline_stages` — ordered stages with colors.
- `crm_followups` — scheduled tasks/messages, channel, body, send_at, status.

### Frontend
- `src/pages/VoiceReceptionistPage.tsx` — public landing with the 5 capability tiles (matches screenshot composition, Oracle styling).
- `src/pages/admin/VoiceReceptionistAdminPage.tsx` — tabs: Agent · Knowledge · Hours & Handoff · Booking · Pipeline · Call Logs · CRM.
- `src/components/voice/*` — CallTimeline, PipelineBoard (kanban), KnowledgeEditor, BusinessHoursEditor, ContactDrawer.
- Add nav entries + module tile on the Super App grid.

### Integrations
- **Twilio** — already linked via connector (`TWILIO_API_KEY` present). User must (a) buy a number in Twilio console, (b) point Voice + Messaging webhooks at the deployed edge URLs (the admin page will display the exact URLs to paste).
- **Google Calendar** — connect Google Calendar connector (workspace owner's account). I'll wire it; you click "Connect" once.
- **ElevenLabs** — already linked, used for voice.
- **Lovable AI Gateway** — Gemini 2.5 Flash for intent + response; no extra key.

## What you do (one-time, after I ship)
1. Buy a Twilio number (or use existing).
2. Approve the Google Calendar connection prompt I'll trigger.
3. Open `/admin/voice-receptionist` → paste webhook URLs into Twilio → set greeting, hours, handoff number, knowledge.
4. Test by calling your number.

## Out of scope (call out before building)
- Multi-tenant CRM per end-user (this is single-business: yours/owner). Adding per-user CRMs doubles the build.
- Native HighLevel API push (we provide a generic webhook that HighLevel can subscribe to via Zapier/their inbound webhook trigger — same effect, no HL-specific code).
- Voicemail transcription as a separate flow (covered by call recording + transcript on missed calls).

## Build order
1. DB migration (all tables + RLS + grants).
2. Edge functions (incoming → status → book → drip → fanout → sms-inbound).
3. Google Calendar connector link.
4. Admin page (config + knowledge + hours + pipeline + call logs).
5. Public capability tiles page + nav entry.
6. End-to-end smoke test instructions in the admin page header.

Approve and I'll execute top-to-bottom.
