# Deploy to Vercel — quick reference

This zip is **fully configured** for the `lesson-t` Firebase project. No
config edits needed before deploying.

## 1. Push to git

```bash
unzip lesson-tutor-app-firebase-ready.zip
cd app
git init
git add .
git commit -m "Lesson Teacher with Firebase wired"
git remote add origin <your-repo>
git push -u origin main
```

If you already have the repo on Vercel, just **replace the files** and
push — Vercel will auto-redeploy.

## 2. Vercel env vars

The Firebase web config is **already in the HTML** (it's public — see
the long-form doc at `public/app/FIREBASE_SETUP.md`). You only need
env vars for the AI keys, which were already set up in your existing
project. No new vars needed for Firebase.

If you don't have these set, set them in Vercel → Project → Settings → Environment Variables:

| Variable | Where it's used |
|---|---|
| `ANTHROPIC_API_KEY` | `api/anthropic.ts` (lessons, exams, AI tutor) |
| `OPENAI_API_KEY`    | `api/openai.ts` (fallback when Anthropic is slow/down) |
| `ELEVENLABS_API_KEY` | `api/elevenlabs.ts` (TTS for kids zone) — optional |

Then **redeploy**.

## 3. Add your Vercel URL to Firebase Authorized domains

If you haven't already:

1. Open <https://console.firebase.google.com> → select project **Lesson T**.
2. **Authentication → Settings → Authorized domains**.
3. Click **Add domain** → type your Vercel URL (e.g. `lesson-teacher.vercel.app`) → **Add**.

Without this step, sign-up will fail with `auth/unauthorized-domain` on the live site.

## 4. Test on the live site

1. Open your Vercel URL.
2. Top-right of the landing page → **🔐 Sign in** chip.
3. Click → **Sign up** tab → fill in name + email + password + level + class → **Create account**.
4. Chip should change to **👤 [your name]**.
5. Open Firebase Console → Authentication → Users — your test user should be there.
6. Open Firestore Database → `users/{uid}` collection — your profile doc should be there.

## What's wired vs. what's not

✅ **Fully wired with Firebase**
- Sign up / sign in / sign out / forgot password
- Student profile (name, level, class, stream, school, state)
- Lessons, quizzes, exam scores, XP, streaks → cloud sync
- Parent ↔ student linking by email
- Parents see live progress for linked children

⚠️ **Local-only (still works, just doesn't sync across devices)**
- Live arena games (still uses bot opponents)
- Spectator chat
- Direct messages between students
- Lobby chat in arena

These can be wired in a follow-up build — they need realtime listeners
and matchmaking logic, which is a bigger job than this update covered.

## If something goes wrong

- **🔐 chip doesn't appear** → Hard-refresh (Ctrl+Shift+R / Cmd+Shift+R). Open DevTools → Console — look for `[LT-FB]` log lines or red errors.
- **`auth/unauthorized-domain`** → Step 3 above.
- **`Missing or insufficient permissions`** → Firestore rules weren't published. Console → Firestore → Rules → confirm they match `public/app/firestore.rules` and click Publish.
- **Sign-up modal opens but Submit fails** → Check the browser console. Most likely Email/Password isn't enabled in Firebase → Authentication → Sign-in method.
