# v3 — Live multiplayer, real chat, language picker

## What changed

### 1. Live arena rooms are real
- Replaced `generateRooms()` (which faked 8 rooms with bot players each refresh) with a Firestore listener on `arena_rooms`. The room list updates in real time as people host, join, leave, and finish matches.
- Empty state shows a clear "Quiet right now" panel instead of a wall of fake rooms.

### 2. AI opponent (not bots, not fake players)
- When you host a room and nobody joins within 20 seconds, you get a popup offering to play against an AI study partner.
- The AI gets the same questions you do, has a 1–3 second "thinking" delay (so it feels like a player), and answers with realistic accuracy (~72% by default).
- Open-ended questions (Spelling Bee, Word Builder) route through `/api/openai` so the AI gives real reasoning.
- AI players appear in the lobby with an "AI" badge so it's always clear who's a human and who isn't.

### 3. Real lobby chat
- Replaced the local-only chat with Firestore subcollection (`arena_rooms/{id}/lobbyChat`).
- All messages run through the existing `SocialDB.filter()` which redacts phone numbers, emails, social handles, and meet-up patterns.
- Real-time updates via `onSnapshot` — anyone in the lobby sees messages instantly.

### 4. Real spectator UX
- Score bars per player update live (visible bar fills proportionally to leader)
- Sorted leaderboard with rank emojis (🥇🥈🥉)
- Real-time spectator chat (separate subcollection from lobby chat)
- Live elapsed-time counter
- Match-finished banner with the winner's name

### 5. Direct messages
- New `dm_threads/{threadId}` collection for student↔student DMs.
- Same `SocialDB.filter()` redaction rules.
- Thread ID format: sorted UIDs joined with `__` (so the same pair always gets the same thread).
- "Same class group only" rule enforced client-side (matching the existing social design).
- *Note: there's no UI yet to start a DM — that hooks into the social-ui-0.js file. The data layer is ready. I'll wire the UI in the next round.*

### 6. Language picker (🇬🇧 🇳🇬 Yorùbá Igbo Hausa)
- New 🌍 globe button in the top nav, available to **everyone** (not just signed-in users).
- 4 options: English, Yorùbá, Igbo, Hausa.
- Choice persists in localStorage for guests, in Firestore profile for signed-in users.
- ~50 most-visible UI strings translated via static dictionary (instant, no API call).
- Lessons in non-English languages: every call to `/api/anthropic` and `/api/openai` gets a system-prompt instruction injected: *"Respond ENTIRELY in [Yorùbá/Igbo/Hausa]"*. The lesson generation respects this without code changes elsewhere.
- Strings not in the dictionary translate via `/api/openai` (gpt-4o-mini) and cache to localStorage.
- Demo: append `?lang=yo` to any URL to switch immediately.

### 7. Voice/TTS
Parked per your call. Will tackle ElevenLabs multilingual after everything else is done.

## Firestore rules — IMPORTANT

The new rules in `public/app/firestore.rules` add:
- `arena_rooms/{roomId}` (anyone signed in can read/update; only host can create/delete)
- `arena_rooms/{roomId}/lobbyChat/{msgId}` (immutable, append-only)
- `arena_rooms/{roomId}/specChat/{msgId}` (immutable, append-only)
- `dm_threads/{threadId}` (members-only)
- `dm_threads/{threadId}/messages/{msgId}` (members-only, immutable)

**You must republish these rules in Firebase Console** for live rooms and chat to work:
1. Firebase Console → Firestore Database → Rules tab
2. Select all → delete → paste from `public/app/firestore.rules`
3. **Publish**

Without republishing, you'll see `Missing or insufficient permissions` errors when anyone tries to host or join a room.

## Files added (3)

```
public/app/js/firebase-realtime-0.js          Realtime data layer + AI opponent
public/app/js/firebase-realtime-wiring-0.js   Patches arena UI to use it
public/app/js/lang-0.js                       Language picker + AI translation
```

## Files edited (3)

```
public/app/index.html              Loads the 3 new scripts
public/app/js/arena-0.js           Exposes FORMATS/GAMES globally for the wiring
public/app/firestore.rules         Added arena_rooms + dm_threads rules
```

## What's still simulated/local-only

- The original arena game runners (`playQuizDuel`, `playMathRace` etc. in arena-0.js) still exist, but the cloud-aware `openCloudGame()` runs **first** — uses real questions, publishes scores live to Firestore, and AI answers are real AI. The fallback runners only activate if Firestore fails.
- DM **UI** (the conversation list and thread viewer) — data layer ready, UI not yet wired into the social-ui pages.
- ElevenLabs voice in Yorùbá/Igbo/Hausa — parked for next round.
