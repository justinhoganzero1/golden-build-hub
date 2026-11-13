# src rules
- Library deletes remove only the member's own user_media rows (bulk delete filters by user_id) and never remove storage files, because the same file can still back Movie Maker projects, templates or other saved work.
- Phone layouts never scroll sideways: html/body clip horizontal overflow and option/tab rows wrap instead of using overflow-x scrolling; reserve horizontal scrollers for tables and picture carousels.
- Owner-only pages stay out of every user-facing route list (chat tool menu, tiles, headers) unless the signed-in account is admin; the routes themselves keep RequireAuth + RequireAdmin so hiding is never the only gate.
- Visitors arriving from Lovable (referrer, embedding page or ?from=lovable) see the funny ad once per tab before the store page, and its end links open oraclelunar.com, so Lovable browsers meet Oracle without signing up and never stay on Lovable hosts.
