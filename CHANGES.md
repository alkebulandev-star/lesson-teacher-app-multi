# Files changed (full list)

```
vercel.json                               NEW: functions block, maxDuration 300s
api/anthropic.ts                          maxDuration 300s, timeout 120s, streaming pass-through
api/openai.ts                             maxDuration 300s, timeout 120s
api/elevenlabs.ts                         maxDuration 120s, timeout 60s
public/app/js/elevenlabs-tts-0.js         shim signals success/failure; preserves native synth
public/app/js/homework-1.js               speakIt fallback, kSpeak number-aware,
                                          kPrev/kNext/kLoad: stop+debounce, keyboard shortcuts,
                                          number letter-tiles, position indicator,
                                          startLessonProgress shows elapsed time after step 10
public/app/js/homework-2.js               kSpeakText routes through speakIt for fallback
public/app/js/shell-1.js                  preflight health check, circuit breaker, retry button,
                                          long-request safety net (still-working toast,
                                          270s hard ceiling, elapsed-time display)
public/app/index.html                     position indicator markup in nav row
FIXES.md                                  documentation
CHANGES.md                                this file
```

## What addresses *"30 seconds might not be enough"*

Three layers, all required:

1. **Vercel Fluid Compute + maxDuration 300s** — the function itself can now run for 5 minutes. This is the hard ceiling that was killing long generations at 60s.

2. **Per-attempt fetch timeout 120s** — inside the function, each call to Anthropic/OpenAI now has 2 minutes to complete a single attempt. With 4 attempts that's potentially ~8 min total elapsed time but each attempt has real headroom.

3. **Client safety net (270s)** — wraps every API call in `shell-1.js`. Shows a "Still working… 23s" toast after 18 seconds so users know it's alive. Hard-aborts at 270s (just under the server ceiling) with a real error + Retry button instead of hanging forever.

## Quickest way to verify the fixes

1. **Numbers** (the "spell one says 1" bug):
   - Open kids zone → tap Numbers in the sidebar.
   - Tutor should say: *"This is the number 1. We say it like this — one. The word one is spelled O — N — E. One!"*
   - You should see TWO rows of letter tiles: a big yellow `1`, then `O` `N` `E`.

2. **Playback fallback** (the silent-when-Eleven-fails bug):
   - In Vercel, temporarily remove `ELEVENLABS_API_KEY` → redeploy.
   - Open kids zone → tap any lesson → you should still hear audio (the browser's built-in voice). Console should log `[speakIt] ElevenLabs failed, falling back: ...`.
   - Restore the key when done.

3. **Navigation**:
   - Open kids zone → press `→` (right arrow). Should go to Next and speak.
   - Press `←` → goes back AND speaks (used to be silent).
   - Position indicator shows `2 / 10`, `3 / 10`, etc.
   - Tap Next 5 times rapidly — only one audio plays (the latest), not five overlapping.

4. **Long lessons / exams reliability**:
   - **Important first step**: in Vercel project settings → Functions → confirm "Fluid Compute" is **enabled**. Then redeploy.
   - Tap a complex lesson (Physics, Further Maths) — should complete reliably even when slow.
   - After 18s of waiting you'll see a "Still working… Xs" toast at the bottom of the screen with a Cancel button.
   - DevTools → Network → click the request → Response Headers — `x-anthropic-attempt: 2` tells you a retry fired and the second attempt won.

5. **API failure handling**:
   - Open `/api/health` — confirms which keys Vercel sees.
   - Temporarily break `ANTHROPIC_API_KEY` (set to `sk-ant-fake`) → redeploy → ask a question. Within a second you'll see a yellow toast *"Lesson Teacher unavailable → switched to Co Lesson Teacher"* and get a real reply from OpenAI.
   - After 3 failures the breaker opens — subsequent requests skip Anthropic entirely for 30s.
   - Break BOTH keys → red Retry toast appears with `Retry / Check status / ×`.

## After deploying — confirm Fluid Compute is on

This is the one Vercel setting that controls whether `maxDuration: 300` actually works on Hobby plans:

Vercel dashboard → your project → **Settings** → **Functions** → **Fluid Compute** must be ✅ enabled.

If it isn't:
- New projects: it's on by default.
- Older projects: toggle it on, then trigger a fresh deploy (Deployments → ⋯ → Redeploy).

Without Fluid Compute, Hobby plans cap at 60s regardless of what `vercel.json` says.
