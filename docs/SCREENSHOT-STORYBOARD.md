# Oracle Lunar — Store Screenshot Storyboard

Capture script for the **6 hero routes** required by the Play Store and App Store. Follow exactly: same device frame, same login state, same time of day, same sample data. Consistency is what makes a listing look professional.

---

## Required output sizes

| Store | Device frame | Pixel size | Format | Notes |
|---|---|---|---|---|
| Google Play (phone) | Pixel 7 / generic 9:19.5 | **1080 × 1920** portrait | PNG or JPEG, sRGB | 2–8 screenshots, no alpha |
| Google Play (7" tab) | optional | 1200 × 1920 | PNG/JPEG | only if tablet listing |
| Apple App Store 6.7" | iPhone 15 Pro Max | **1290 × 2796** portrait | PNG, no alpha, sRGB | **required** |
| Apple App Store 6.5" | iPhone 11 Pro Max | **1242 × 2688** portrait | PNG, no alpha | **required** as fallback |
| Apple App Store 12.9" iPad Pro | iPad Pro 6th gen | **2048 × 2732** portrait | PNG | only if iPad build shipped |

All Apple PNGs **must be flat RGB (no alpha channel)** or App Store Connect rejects them.

Blank canvas templates at the exact required pixel sizes are in `/mnt/documents/store-assets/SCREENSHOT-TEMPLATE-*.jpg` — drop your captured screenshot into the template and export to lock the size.

---

## Capture environment (do this ONCE before shooting)

1. **Sign in** as the demo account `demo@oracle-lunar.online` (admin bypass enabled so paywalls don't appear).
2. **Mute** the Oracle (top right) so the orb doesn't speak mid-capture.
3. **Disable** any toast notifications — close all open toasts before each shot.
4. **Force dark mode** (already default). Confirm the background is the cinematic obsidian, not white.
5. Use **Chrome DevTools → Device Mode** with these presets:
   - Android shots: **Pixel 7 (412 × 915)** at devicePixelRatio 2.625 → screenshot exports as 1080 × 1920 ✅
   - iPhone 6.7" shots: **iPhone 15 Pro Max (430 × 932)** at devicePixelRatio 3 → exports as 1290 × 2796 ✅
   - iPhone 6.5" shots: **iPhone 11 Pro Max (414 × 896)** at devicePixelRatio 3 → exports as 1242 × 2688 ✅
6. Hide the Lovable badge: `?forceHideBadge=true` query param on every URL.

---

## The 6 hero screens (in order)

| # | Route | Headline overlay (add in Figma after capture) | What to show in the screenshot |
|---|---|---|---|
| 1 | `/` | **"Your AI best friend, always here for you."** | Landing hero with the gold crescent + animated orb, "Get Started" CTA visible. |
| 2 | `/oracle` | **"Talk. The Oracle answers."** | Live conversation, 2–3 messages in the thread, orb mid-pulse, mic active. |
| 3 | `/photography-hub` | **"Studio-grade AI photography."** | Brand kit tile + 2 generated portraits visible, watermark badge in corner. |
| 4 | `/movie-studio-pro` | **"4K cinematic AI movies."** | Storyboard timeline with 3 scenes loaded, "Render" button highlighted. |
| 5 | `/dashboard` | **"All 40+ tools, one tap away."** | Module grid in dark theme, gold accents on tiles, no scroll position offset. |
| 6 | `/media-library` | **"Every creation, saved forever."** | At least 6 tiles populated with thumbnails (avatars, photos, movies). |

---

## Step-by-step capture script

For **each** route above, repeat for **each** required device size (Pixel 7, iPhone 6.7", iPhone 6.5"). That's **6 routes × 3 devices = 18 screenshots minimum**.

```
1. Open Chrome → DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Select device preset (Pixel 7 / iPhone 15 Pro Max / iPhone 11 Pro Max)
4. Navigate to:  https://oracle-lunar.online{route}?forceHideBadge=true
5. Wait 4 seconds for hero animation to settle on the gold accent frame
6. DevTools menu (⋮) → "Capture screenshot"  (NOT "full size" — viewport only)
7. Save as: oracle-lunar_{route-slug}_{device-slug}.png
   e.g.  oracle-lunar_oracle_iphone-6.7.png
8. Drop into the matching template in /mnt/documents/store-assets/SCREENSHOT-TEMPLATE-* and flatten before export
```

---

## File naming convention (Apple + Google both accept this)

```
playstore/
  01_landing_1080x1920.png
  02_oracle_1080x1920.png
  03_photography_1080x1920.png
  04_movie-studio_1080x1920.png
  05_dashboard_1080x1920.png
  06_media-library_1080x1920.png

appstore/
  iphone-6.7/
    01_landing_1290x2796.png
    …
  iphone-6.5/
    01_landing_1242x2688.png
    …
```

Upload order = display order. Screen #1 is the one shown in search results, so the landing hero with the tagline must always be first.

---

## Quality checklist before upload

- [ ] No status-bar clock variation between shots (set to 9:41 AM via DevTools sensors → "Set custom time")
- [ ] No personal data (real names, real emails, real phone numbers) visible anywhere
- [ ] No third-party logos visible (HeyGen, ElevenLabs etc. — covered by feature-proxy refactor)
- [ ] No "8K" wording anywhere — only "4K" (already fixed in code)
- [ ] All text legible at 50% zoom (store thumbnails are tiny)
- [ ] PNG export verified: open in Preview, "Show Inspector" → channels = RGB, **not** RGBA
