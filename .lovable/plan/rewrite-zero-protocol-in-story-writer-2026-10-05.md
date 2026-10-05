# Rewrite Zero Protocol in Story Writer

## Outcome
- Rewrite the complete saved book using Oracle Lunar’s Story Writer.
- Keep the established premise, characters, humour, action, science-fiction world, and resolved ending.
- Keep every finished chapter at **4,000 words or fewer**.
- Replace the current saved manuscript only after the complete rewrite succeeds.

## Build
1. Correct Story Writer’s rewrite engine, which currently forces extremely long chapters, so it supports a firm 4,000-word ceiling.
2. Make the rewrite continuity-safe: use compact summaries of prior chapters and the full current chapter instead of silently cutting source material.
3. Add a protected whole-book process that stages rewritten chapters, checks chapter order, completeness, repetition, and word counts, then saves the replacement in one final operation.
4. Preserve the current cover, back cover, title, author, blurb, publishing details, and artwork unless the rewrite requires text-only metadata updates.
5. Run the rewrite on the saved **Zero Protocol: The Doolan Defense** book and verify every chapter is present and no chapter exceeds 4,000 words.
6. Export a clean replacement manuscript for ElevenLabs after the saved book passes validation.

## Safety
- The existing 59,510-word manuscript remains unchanged if any chapter fails to generate or validate.
- AI calls are made through the app’s existing member-wallet rules; the owner exemption remains unchanged.
- No Amazon upload or publication is claimed or attempted.

## Technical details
- Update the Story Writer rewrite controls and its server-side AI call to enforce the requested maximum.
- Use the assigned Oracle Lunar text model and streamed generation path.
- Save the complete rewritten chapter array through the existing Story Writer save operation only after validation.
