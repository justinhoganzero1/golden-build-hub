# src rules
- Library deletes remove only the member's own user_media rows (bulk delete filters by user_id) and never remove storage files, because the same file can still back Movie Maker projects, templates or other saved work.
- Phone layouts never scroll sideways: html/body clip horizontal overflow and option/tab rows wrap instead of using overflow-x scrolling; reserve horizontal scrollers for tables and picture carousels.
