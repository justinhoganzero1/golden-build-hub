

## Plan: Oracle Input Fix, Live Vision, and Cross-App Media Integration

### Problem Summary
1. **Oracle input doesn't clear** after sending a typed message
2. **Speech auto-send** timer is 2.0s, user wants 2.5s
3. **Live Vision** page is a static mockup with no camera or AI functionality
4. **Creations not saved** to Media Library from most apps (only Avatar Generator saves)
5. **No cross-app media sharing** — apps can't access each other's images/files

---

### Changes

#### 1. Fix Oracle Input Clearing (OraclePage.tsx)
- Add `setInput("")` at the start of `sendMessage()` so the text field clears immediately when user hits Send or presses Enter
- Change silence timer from 2000ms to 2500ms for speech auto-send

#### 2. Build Functional Live Vision (LiveVisionPage.tsx)
- Full rewrite: add camera access via `getUserMedia`
- Capture frames from the video feed
- Send frames to the `image-gen` edge function (or a new vision endpoint using Gemini's vision model) for AI analysis
- Display real-time analysis results (object detection, text recognition, scene description)
- Auto-save captured snapshots to Media Library via `useSaveMedia`

#### 3. Auto-Save Creations to Media Library
Add `useSaveMedia` integration to these pages that currently don't save:
- **PhotographyHubPage** — save generated/edited photos
- **ProfilePage** — save generated avatars
- **AppBuilderPage** — save app screenshots (optional)

#### 4. Cross-App Media Picker Component
Create a reusable `MediaPickerDialog` component:
- Fetches user's media library via `useUserMedia`
- Displays grid of saved images/videos/audio with search and type filters
- Returns the selected media URL to the calling component
- Integrate into: Photography Hub (use as source image), Avatar Generator (use as reference), Profile Page (pick from library), and Oracle (attach image to message)

#### 5. Update Image-Gen Edge Function for Vision
- Add a "vision" mode to the existing `image-gen` function (or create a small `live-vision` function) that accepts a base64 image and returns AI scene analysis using Gemini's vision capabilities

---

### Files to Create
- `src/components/MediaPickerDialog.tsx` — reusable media selection modal

### Files to Edit
- `src/pages/OraclePage.tsx` — fix input clearing + 2.5s timer
- `src/pages/LiveVisionPage.tsx` — full camera + AI vision implementation
- `src/pages/PhotographyHubPage.tsx` — add auto-save to library + media picker
- `src/pages/ProfilePage.tsx` — add auto-save to library + media picker
- `src/pages/AvatarGeneratorPage.tsx` — add media picker for reference images
- `supabase/functions/image-gen/index.ts` — add vision analysis mode

