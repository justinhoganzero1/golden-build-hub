# Oracle’s live video presenter

## Experience
- Use the same fictional female presenter from the current advertisement as Oracle’s default face. Keep members’ deliberately selected avatars and voices intact.
- Make the main Oracle screen feel like a video call: a large presenter, clear listening/thinking/speaking states, microphone, speaker, interruption and end-call controls. Start microphone and paid video only after an explicit tap, not simply when the app opens.
- Keep Oracle’s existing conversation, memory, model selection and creation tools. Do not introduce a second assistant.
- Carry out supported creation requests while the conversation stays open. After the requested product genuinely finishes, Oracle asks “Would you like to see it?” Provide “Show me” and “Later”; keep the finished product accessible in the conversation and Library.
- Reveal real image, video, audio, story and app results using their correct viewers. Failed, queued or incomplete work must never be described as finished. Only confirmed Library saves may be described as saved.

## True speaking video
Juzzy’s latest requirement is no-cost speech. Make device-generated speech the default for this experience, using the voices actually available on the device. This avoids paid speech-generation calls; it does not make chat, product generation, hosting or lifelike video free. Proxies do not eliminate those costs or create unlimited voices. Preserve saved voice preferences and offer an explicit choice between device speech and existing wallet-paid premium speech.

For true speaking video, LiveAvatar’s Avatar Only (LITE) mode remains a possible future live-video layer, not a free implementation. It accepts Oracle’s own audio and does not replace Oracle’s reasoning or tools. Do not activate this paid service under the latest no-cost request. Test the exact ad presenter rather than substituting a stock person or passing a prerecorded loop off as live speech.

**Required before live activation:** a LiveAvatar account/API connection, acceptance of the fictional presenter as a custom avatar, and verified account pricing. Its photo-avatar creation is currently an alpha feature; acceptance and likeness are not guaranteed. If the presenter is rejected, pause and explain the alternative rather than silently changing her.

If paid live video is later authorised, members pay their own verified provider costs plus the existing minimum 20% margin. Display the actual session price before starting. Preserve the protected owner exemption. No automatic paid video sessions or uncertain payment retries.

## Technical details
- Extend the canonical `/oracle` screen and existing voice controller. Keep email/password authentication and membership checks unchanged.
- Device speech uses the existing speech queue with explicit microphone/speaker activation and cancellation; it must not call paid TTS in device mode. No proxy network is needed.
- Defer live-session authorization, wallet reservation/settlement and LiveAvatar’s 24 kHz PCM bridge until a paid service is explicitly authorised and connected. Device speech cannot be assumed to expose audio suitable for that bridge.
- Introduce a typed finished-artifact handoff containing actual payload, generation state and independent save state. Stage results until reveal; repair the current immediate/incorrect viewers and false “ready” paths without removing existing tools.
- Use the original presenter asset through the project asset flow. Existing audio-only Oracle remains usable when video is unavailable, with the limitation made clear.

## Verification
- Add tests for completion versus failure/queued status, save confirmation, reveal actions, existing persona preservation and no paid TTS calls in device mode.
- Sign in and verify a real creation saves, offers a reveal, opens correctly and reopens from Library.
- Once the service is connected, verify real custom-presenter video, synchronized speech, interruption, stopping, insufficient funds and usage reconciliation. Measure actual reply delay; do not promise human-equivalent realism or a guaranteed three-second response.
- Check phone and desktop layouts. Real phone microphone/speaker testing remains necessary to confirm audible quality.

## Delivery boundary
Presenter appearance, device speech and creation-handoff work can proceed after approval. That first version is not a full lifelike talking video. True live speaking video remains deferred because it requires an external service and ongoing costs; do not promise a free FaceTime-equivalent result. Publishing is separate and will only happen when requested.