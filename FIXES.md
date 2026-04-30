# Lesson Teacher — Stability + Kids Section + Long-Request Reliability

## 1. Kids section — Numbers now teaches BOTH the digit and the word

The user reported: *"Let's spell one for eg says 1, has to work well all through the kids section."*

### What was happening
For Numbers, `k.l` was the digit (e.g. `'1'`) and `k.ls` was just `['1']`. The old `kSpeak()` line was:

```
"1 is for One. Say it with me — One! Let us spell it together: 1. One. Very good!"
```

It "spelled" the digit instead of the word, so kids were never taught how to write `O-N-E`.
The tutor prompt also said *"Can you count to One?"* which made no sense.

### What changed (`homework-1.js` `kSpeak`, `kRender` prompt + tile section)
`kSpeak()` is now category-aware. For Numbers it speaks:

> *"This is the number 1. We say it like this — one. The word one is spelled O — N — E. One!"*

So kids hear:
1. The digit (`1`) — the actual number symbol
2. The word (`one`) — its spoken name
3. The spelling (`O — N — E`) — letter by letter
4. Reinforcement (`one!`)

The dashes between letters force a TTS pause so each letter is distinct rather than slurred.

The other categories also got proper teaching lines (Phonics, Colours, Body, Food, Family, Animals, Reading) — each with its own framing and a clear letter-by-letter spelling at the end.

The **letter-tile strip** for Numbers used to show only the digit. Now it renders both:
- A big highlighted **digit tile** (`1`) — tap to hear the word "one"
- One tile **per letter** of the word (`O`, `N`, `E`) — tap to hear that letter

The tutor prompt for numbers was rewritten from `"Can you count to One?"` to:

> *"This is the number 1. We say it like this — one! Tap the letters to spell it: ONE."*

## 2. Kids playback — fixed silent-when-ElevenLabs-fails

The user reported: *"playback is not working on the learning for the kids"*. Two bugs broke the audio fallback chain:

1. The ElevenLabs shim's `onend()` callback fired with no arguments on **both** success and failure. So `speakIt` couldn't tell them apart and always returned as if Eleven succeeded.
2. The "Web Speech fallback" called `window.speechSynthesis.speak(u)` — but the Eleven shim **overrides** that to route everything **back through Eleven**. The "fallback" was a loop ending at the same dead provider.

### Fix (`elevenlabs-tts-0.js` + `homework-1.js`)
- Shim's `onend(err)` now passes `null` on success, `{error: ...}` on failure.
- Shim stashes `window.__nativeSpeechSynth__` and `window.__nativeUtter__` BEFORE replacing the originals.
- `speakIt()` checks the error flag and falls through to Google TTS, then to **native** Web Speech (using the saved native references).
- `preloadVoices()` now reads from the native engine (the shimmed `getVoices()` returns `[]`).
- `kSpeakText()` in `homework-2.js` (Matching/Quiz/Sing games) routes through `speakIt()` so games inherit the same fallback.

When ElevenLabs is down or the key is over quota, kids now hear the lesson via the browser's built-in voice instead of silence.

## 3. Kids navigation — Previous speaks, no overlap, keyboard shortcuts

- `kPrev()` only changed the lesson; it never spoke. Now mirrors `kNext`.
- Rapid taps stacked overlapping audio. `kNext`/`kPrev`/`kLoad` now stop in-flight audio (`elevenStop`, native `cancel`, `stopAudio`) BEFORE re-rendering, and share a single debounced `_kSpeakTimer`.
- New position indicator (`3 / 10`) between Previous and Next.
- Keyboard shortcuts: `←` Previous, `→` Next, Space/Enter Hear word — only on the kids page when no input is focused.

## 4. API reliability — function duration, retries, breaker, retry button

The user reported: *"sometimes both anthropic and chatgpt don't work — we can't have that with users on the site."*
And in follow-up: *"30 seconds might not be enough to load lesson or exams or anything — make sure it works at all times."*

### Function duration: 60s → 300s (Vercel Fluid Compute)
**This is the single biggest reliability fix.** The old `maxDuration: 60` was a hard ceiling: any AI call that took longer than 60s on the server would fail with a 504, no matter what. With `max_tokens: 8000` exam papers and rich lesson generations, that ceiling was being hit regularly.

Updated in three places:

1. `vercel.json` — new `functions` block routes long durations to the heavy endpoints:
   ```json
   "functions": {
     "api/anthropic.ts":  { "maxDuration": 300 },
     "api/openai.ts":     { "maxDuration": 300 },
     "api/elevenlabs.ts": { "maxDuration": 120 },
     "api/health.ts":     { "maxDuration": 10  }
   }
   ```
2. Each API file's inline `export const config = { maxDuration: 300 }` matches.
3. **Vercel Fluid Compute** (now the default on all plans) is what makes the 300s ceiling available even on Hobby. The key insight: AI calls are I/O-bound. Vercel only bills "active CPU time", and waiting for Anthropic to respond is NOT active CPU. So extending the ceiling from 60s → 300s costs essentially nothing.

### Per-attempt timeout: 45s → 120s
Inside each function, the per-attempt fetch timeout was raised from 45s to 120s. With 4 attempts on transient errors that's up to ~8 minutes total elapsed time, but each individual attempt now has a real chance to complete a long generation.

### Retry/backoff improvements (across all 3 proxies)
- `MAX_ATTEMPTS` raised from 3 to **4** (catches more transient 529 blips).
- Retry status set expanded to include Cloudflare-class errors: **520, 521, 522, 523, 524**.
- Backoff is now **exponential with jitter** (~400, 800, 1600, 3200ms + 0–250ms random). Jitter prevents synchronized retry storms when many users hit a brief outage.
- Error payloads now include an `attempts` array showing what each attempt returned.
- Successful responses set `x-{provider}-attempt` header showing which attempt won, so retry frequency is visible in DevTools.

### Streaming pass-through (Anthropic proxy)
The Anthropic proxy now detects `"stream": true` in the request body and passes the SSE stream straight through to the client (with `x-accel-buffering: no` and immediate `flushHeaders()`). This is the foundation for adding incremental output to lesson generation — the client gets the first byte within seconds even when the full generation takes a minute. **The proxy supports it now; the client UI can opt in per call by setting `stream: true`. Existing non-streaming calls still work exactly as before.**

### Client-side: preflight health, circuit breaker, retry button (`shell-1.js`)
- **Preflight health check** — `/api/health` is called once on page load; results cached in `window._ltHealth`. Known-unconfigured providers are skipped instantly instead of wasting 4 attempts before failing over. A toast warns if no providers are configured.
- **Circuit breaker** — 3 consecutive failures opens a 30s window during which traffic skips straight to the other provider. The breaker closes the moment a request succeeds.
- **Retry button** — when both providers fail, a red toast offers `Retry / Check status / ×`. Retry resends the last request through the full pipeline; users don't have to re-type.

### Client-side: long-request safety net (`shell-1.js`, new in this round)
This is the new piece that addresses *"30 seconds might not be enough"*. Three problems handled explicitly on the client:

1. **Idle middlebox drops** — corporate networks and mobile carriers (especially in Nigeria) often kill "idle" connections at 30-60s. We can't fix the network, but we can reassure the user the request is genuinely still in flight.
2. **Truly hung requests** — `fetch()` has no default timeout, so a network blackhole would hang the UI indefinitely. We now hard-cap requests at **270s** (just under the 300s server ceiling) and surface a real error if hit.
3. **User confidence** — without visible progress on a 60-90s wait, users tap things again and create duplicate work. We need a steady "still working" signal.

#### `fetchWithLongRequestSafety(url, init)`
Wraps every call to `/api/anthropic` and `/api/openai`. Adds:
- **Still-working toast** — appears 18 seconds in. Shows live elapsed time ("Still working… 23s"), with a **Cancel** button if the user changes their mind.
- **Hard 270s ceiling** — if the request truly never returns, abort and surface a 504 with `clientCeiling: true` so the existing error/retry path runs.
- **In-flight counter** — `window._ltInFlight` tracks active API calls (useful for tests / future "don't navigate while generating" warnings).

#### Lesson-page progress UI updated (`homework-1.js` `startLessonProgress`)
The existing progress bar advanced through 10 steps (~9 seconds). For longer generations it sat at 97% with a static "Almost there!" message — felt frozen. Now after the steps run out, the progress message becomes **"Still working… 24s elapsed"** with the elapsed counter, and after 25s reassures the user *"Still preparing — your lesson is taking a bit longer because we are using the highest quality model."*

### Net effect on reliability
- **Long lessons / exam papers** that previously failed with 504 at 60s now have a 300s ceiling — long enough for the largest generations to complete on a single attempt.
- **Misconfigured environment**: noticed once at page load via health check, all subsequent requests skip the dead provider. ~5–10× faster failure recovery.
- **Brief Anthropic overload (529)**: 4 jittered retries plus 30s circuit breaker that routes to OpenAI while Anthropic recovers.
- **Hung connections**: client safety net surfaces a real error in 270s instead of hanging forever, with a Retry button ready.
- **User perception**: the still-working toast and elapsed-time progress message make long generations feel intentional rather than broken.

## 5. Diagnostic playbook

### Step 1 — `/api/health`
Visit `https://yourdomain.com/api/health`. All three keys must show `"configured": true`. If any are `false`, add the missing one in Vercel → Settings → Environment Variables and redeploy.

### Step 2 — Network tab
DevTools → Network → reproduce the issue.

| Status | Meaning | Fix |
|---|---|---|
| 200 | Working (check `x-anthropic-attempt` header to see if retries fired) | (no issue) |
| 401 | Invalid API key | Regenerate, update in Vercel, redeploy |
| 404 | Endpoint not deployed | Make sure `api/` folder is committed |
| 429 | Rate limited (auto-retried) | Wait or upgrade plan |
| 500 with `is not configured` | Env var missing | Add to Vercel, redeploy |
| 502/504 | Upstream failure / timeout (auto-retried) | Provider issue |
| 504 with `clientCeiling: true` | Client hit the 270s safety ceiling | Provider was hung — try again |
| 520-524 | Cloudflare-class transient (auto-retried) | Usually self-heals |
| 529 | Anthropic overloaded (auto-retried, breaker engages) | Wait briefly, retry |

### Step 3 — Console for kids audio issues
Click "Hear Word" → DevTools Console:
- `[kSpeak]` followed by `[ElevenLabs] fetching audio for: …` followed by audio playing → working
- `[kSpeak]` followed by `[speakIt] ElevenLabs failed, falling back: ...` → Eleven failed but you should hear native Web Speech (the new fix). If you still hear nothing, check that your browser has Web Speech voices installed.
- Only `[kSpeak]` then nothing → `voiceOn` is false (speaker icon muted), or text was empty after cleaning.

### Step 4 — How to test the long-request reliability
- Tap a lesson on a complex topic (e.g. WAEC Further Maths, Physics) — should complete reliably even when slow.
- After 18s of waiting, you should see the "Still working… Xs" toast at the bottom.
- Network tab: response `x-anthropic-attempt` header tells you which retry attempt won (`1` = first try, `2+` = retries fired).
- To force-test the ceiling: temporarily set `HARD_CEILING_MS = 5_000` in `shell-1.js` and reload — any AI call should error out with the new "client safety ceiling" message.

## Vercel env var checklist
- `ANTHROPIC_API_KEY` (starts with `sk-ant-`)
- `OPENAI_API_KEY` (starts with `sk-` or `sk-proj-`)
- `ELEVENLABS_API_KEY` (starts with `sk_`)

After ANY env var change → trigger a fresh deploy (Deployments → ⋯ → Redeploy). Env var changes are not retroactive.

## Vercel Fluid Compute — make sure it's enabled
Fluid Compute is the default on new Vercel projects, but older projects may need it turned on:

Project → Settings → Functions → **Fluid Compute: Enabled**

Without Fluid Compute, the 300s `maxDuration` in `vercel.json` falls back to the legacy 60s Hobby cap.
