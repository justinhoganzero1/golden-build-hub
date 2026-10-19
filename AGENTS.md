# Project Rules
- Oracle voice activation requires an explicit composer gesture and reuses its playback element; this respects microphone consent and mobile autoplay restrictions.
- Oracle microphone teardown runs only on page unmount or an explicit stop, never on render-dependent objects; otherwise listening silently shuts down during screen updates.
- Oracle voice playback streams decoded MP3 frames when supported and buffers only on unsupported browsers; early complete speech phrases reduce latency without replaying synthesis or bypassing billing.
- Route all app-wide Oracle launchers to the canonical /oracle chat instead of mounting a second chat engine, so microphone, model selection and tool execution have one owner.

- Whole-book rewrites must stage and validate every chapter before one final database replacement, because partial saves can corrupt a manuscript.
- Recovery must never automatically remount paid actions, replay uncertain side effects, or weaken authentication; preserve drafts and reconcile outcomes first.
- Large manuscript recovery uses account-scoped IndexedDB, while small Oracle drafts use account-scoped localStorage, to preserve artwork without exhausting browser quotas.
- Daily monitoring performs SQL-only integrity checks and records deduplicated owner incidents; endpoint preflight checks are availability evidence, never proof of paid flows.
- Enforce the billing margin on database writes as well as pricing helpers; exempt only protected owner roles in compliance reports and preserve historical financial records.
- Long-running text generation uses the Lovable AI Gateway Responses API through shared server-only helpers, because credentials and prompts must never reach the browser.- Member AI agents, agent stats and chat histories live in the backend (user_agents, agent_stats, agent_chats) with localStorage only as a cache, so they follow the member across devices.
