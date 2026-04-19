---
name: Owner Unrail Mode (Master Oracle)
description: Admin-only Oracle bypass that strips behaviour rails for the owner while keeping M-rating + safety filters for normal users
type: feature
---
The master Oracle (oracle-chat edge function) detects the admin email (`justinbretthogan@gmail.com` via `ADMIN_EMAIL`) and switches into OWNER UNRAIL MODE. In this mode, all behavioural rails are suspended — TTS-format rules, paywall-humour scripts, "no naming yourself", "never threaten", first-meeting tour, daily promotion, markdown ban, cheeky-deflection scripts. R-rated / explicit / profane / dark / unfiltered output is allowed.

Hard locks that remain ALWAYS active even for owner:
1. No CSAM / sexualisation of minors (matches `ABSOLUTE_BLOCK` in `src/lib/contentSafety.ts`).
2. No real-world terrorism / bioweapon / mass-casualty operational instructions.

Owner also gets a stronger model (`google/gemini-2.5-flash`) and 1800 max_tokens vs public 400. Public users keep the full M-rating filter, behaviour rails, and `flash-lite`. The unrail is invisible — never mentioned to non-admins.
