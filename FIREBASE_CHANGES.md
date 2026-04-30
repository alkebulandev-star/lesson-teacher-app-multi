# Firebase wiring — what changed in this update

This update wires up Firebase Authentication + Firestore across all four
existing data layers without rewriting any of them. The app keeps working
without Firebase configured (localStorage-only), exactly as today.

For setup, read **`public/app/FIREBASE_SETUP.md`**.

## Files added (5)

```
public/app/js/firebase-0.js              Auth + cloud data layer (loads Firebase v10)
public/app/js/auth-ui-0.js               Sign-up / sign-in modal + account chip
public/app/js/firebase-wiring-0.js       Glue between cloud + existing UI
public/app/firestore.rules               Security rules — paste into Firebase Console
public/app/FIREBASE_SETUP.md             Step-by-step setup guide
```

## Files edited (1)

```
public/app/index.html
  + Inline Firebase config block (commented-out template)
  + Three new <script> tags: firebase-0.js (module), auth-ui-0.js,
    firebase-wiring-0.js
  • Fixed a malformed orphan </html>function kzOpenSidebar()… block at
    the very end of the file — the closing tags and a trailing JS
    snippet had been merged into one broken line. The script is now
    properly wrapped in <script>…</script> before </body></html>.
```

## What's wired

| Feature | Behaviour |
|---|---|
| **Sign up / sign in** | Email + password. Role picker (student vs parent). Students fill name + level (Kids / Primary / JSS / SSS) + class + state. Parents only need name + email. |
| **Lessons & XP** | `_sessionProgress` (XP, streak, topics, quiz results, exam results) syncs to `users/{uid}/progress/main` after every `saveProgress()` call. On sign-in, cloud data hydrates the local cache. |
| **Exam results** | `recordExamResult()` writes to `_sessionProgress.examResults`, which is part of the synced doc. Parents see the latest exam in the linked-children panel. |
| **Games / Arena** | `ArenaDB.recordMatch()` publishes leaderboard rows to `arena_leaders/{uid}_{classGroup}_{scope}_{weekKey}` with merge writes (concurrent matches don't overwrite). `ArenaDB.topLeadersAsync()` prefers cloud rows, falls back to local. |
| **Parent Hub** | Parents can manually add children (existing flow, now cloud-synced) **or** link a real student by email from the Progress tab. Linked children show live XP / topics / streak / latest exam pulled directly from the student's account. |
| **Social** | `SocialDB.saveMe()` mirrors to `users/{uid}/social/profile`. The local discovery list with sample classmates still works as today. |
| **Auth chip** | A 🔐 / 👤 chip appears in the landing-nav. Click it to sign in/up; once signed in, click for an account menu (Profile, My progress, Sign out). |
| **Smart routing** | When a signed-in parent clicks "Enter Classroom", they're routed to the Parent Hub. Signed-in students keep `enterCL()` but with their name and class prefilled from the profile. |

## Architecture

`firebase-0.js` is the only file that talks to the Firebase SDK. It
exposes two globals that the rest of the app uses:

```
window.LTAuth   — signUp / signIn / signOut / resetPassword / onChange / user
window.LTCloud  — saveProfile / loadProfile / saveProgress / loadProgress /
                  saveParentState / loadParentState / linkChildByEmail /
                  unlinkChild / listLinkedChildren / fetchChildProgress /
                  saveSocialProfile / loadSocialProfile /
                  saveArenaProfile / loadArenaProfile /
                  publishMatch / topLeaders / hydrate
```

When the user signs in, `firebase-0.js` patches the existing writers
(`saveProgress`, `phSave`, `ArenaDB.saveProfile`, `ArenaDB.recordMatch`,
`SocialDB.saveMe`) so each local write is mirrored to the cloud with a
600 ms debounce. **Local writes are never blocked** — the cloud sync
runs in the background and a failure just means the next save will
retry the merged state.

## Security model

See `firestore.rules` for the actual rules. In short:

- A user can read & write their own profile and subcollections.
- A parent who has an active `parent_links/{parentUid_childUid}` row
  can **read** the child's progress doc — never write.
- Arena leaderboard rows are world-readable (signed-in users), but a
  given row can only be written by the user whose `uid` is stamped on
  it. Match-recording uses merge writes so two concurrent matches by
  the same user can't lose each other's XP.
- The `apiKey` in the Firebase config is **not** a secret. Security is
  enforced entirely by these rules.

## Test plan

1. Open the app — no behavioural change vs. today (no config = guest mode).
2. Add Firebase config per `FIREBASE_SETUP.md` → reload.
3. Click 🔐 chip → sign up as student → fill form → land on landing.
4. Click "Enter Classroom" → name + level should be prefilled.
5. Complete a lesson / take a mock exam.
6. Open Firebase Console → Firestore → `users/{uid}/progress/main` should show your XP/streak/topicsCompleted.
7. Sign out, sign up as parent.
8. Parent Hub → Progress → "Link your child's real account" → enter the student's email → Link.
9. Live XP/streak/topics/last-exam appear for the linked child.
10. Sign out → reload → no behavioural change vs. step 1 (graceful degradation).
