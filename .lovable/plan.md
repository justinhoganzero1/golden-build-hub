# Oracle’s live video presenter

## Experience
- Use the same fictional female presenter from the current advertisement as Oracle’s default face. Keep members’ deliberately selected avatars and voices intact.
- Make the main Oracle screen feel like a video call: a large presenter, clear listening/thinking/speaking states, microphone, speaker, interruption and end-call controls. Start microphone and paid video only after an explicit tap, not simply when the app opens.
- Keep Oracle’s existing conversation, memory, model selection and creation tools. Do not introduce a second assistant.
- Carry out supported creation requests while the conversation stays open. After the requested product genuinely finishes, Oracle asks “Would you like to see it?” Provide “Show me” and “Later”; keep the finished product accessible in the conversation and Library.
- Reveal real image, video, audio, story and app results using their correct viewers. Failed, queued or incomplete work must never be described as finished. Only confirmed Library saves may be described as saved.

## True speaking video
Use LiveAvatar’s Avatar Only (LITE) mode as the proposed live-video layer. It accepts Oracle’s own audio and does not replace Oracle’s reasoning or tools. Test the exact ad presenter rather than substituting a stock person or passing a prerecorded loop off as live speech.

**Required before live activation:** a LiveAvatar account/API connection, acceptance of the fictional presenter as a custom avatar, and verified account pricing. Its photo-avatar creation is currently an alpha feature; acceptance and likeness are not guaranteed. If the presenter is rejected, pause and explain the alternative rather than silently changing her.

Members pay their own verified provider costs plus the existing minimum 20% margin. Display the actual session price before starting. Preserve the protected owner exemption. No free automatic video sessions or uncertain payment retries.

## Technical details
- Extend the canonical `/oracle` screen and existing voice controller. Keep email/password authentication and membership checks unchanged.
- Create authenticated, server-owned session authorization and bounded wallet reservation/settlement. Keep provider keys off the browser; expose only limited session credentials. Disconnect and reconcile usage on stop, expiry, error or departure.
- Convert existing Oracle audio to LiveAvatar’s required 24 kHz mono PCM stream. Synchronize playback with the live video; avoid playing the same reply twice. Forward interruptions and tear down the session without replaying generation.
- Introduce a typed finished-artifact handoff containing actual payload, generation state and independent save state. Stage results until reveal; repair the current immediate/incorrect viewers and false “ready” paths without removing existing tools.
- Use the original presenter asset through the project asset flow. Existing audio-only Oracle remains usable when video is unavailable, with the limitation made clear.

## Verification
- Add tests for completion versus failure/queued status, save confirmation, reveal actions, existing persona preservation and session charging boundaries.
- Sign in and verify a real creation saves, offers a reveal, opens correctly and reopens from Library.
- Once the service is connected, verify real custom-presenter video, synchronized speech, interruption, stopping, insufficient funds and usage reconciliation. Measure actual reply delay; do not promise human-equivalent realism or a guaranteed three-second response.
- Check phone and desktop layouts. Real phone microphone/speaker testing remains necessary to confirm audible quality.

## Delivery boundary
Appearance and creation-handoff work can proceed after approval. Live speaking video cannot be called working until the external account, custom-avatar acceptance and pricing are verified. Publishing is separate and will only happen when requested.