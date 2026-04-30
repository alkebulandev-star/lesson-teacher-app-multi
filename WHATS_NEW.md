# What's new in this build

## ✅ Google sign-in
The auth modal now shows **"Continue with Google"** as the first option
on both Sign-up and Sign-in. To activate it:

1. Firebase Console → **Authentication → Sign-in method**
2. Click **Add new provider → Google**
3. Toggle Enable → set a project support email → **Save**
4. Reload your site — the button works immediately

When a student signs up with Google, a small **"One more step"** modal
asks them to pick their level (Kids / Primary / JSS / SSS), class, and
stream. Then they're routed straight into the right zone.

## ✅ Apple sign-in
Button is in the modal but disabled with a "coming soon" tooltip.
Apple sign-in requires a paid Apple Developer account ($99/year) plus
a Service ID setup in their portal. When you're ready, message me and
I'll wire it up — the modal already has the slot for it.

## ✅ Smart post-signup routing
- **Student signs up** → goes straight into their classroom (Kids zone for kids, regular classroom otherwise) with name + class pre-filled. **No more level-picker after signing up.**
- **Parent signs up** → goes straight to Parent Hub.
- **Google sign-up student** → "One more step" modal → then classroom.

## ✅ Role-based access (with demo override)
- **Students cannot enter Parent Hub** (gentle redirect with a friendly toast).
- **Parents see the full site** — they can browse classroom, exam centre, kids zone, languages, everything (you wanted parents to see what their kids do).
- **Demo mode**: add `?demo=1` to the URL and all gating disappears — useful for sharing with testers / showcasing the site.

## ✅ Game-time gate (Live Arena)
Live Arena is now gated for students. It opens when:
- It's **Saturday or Sunday**, OR
- The student earned fun-time today by completing **3 topics** OR scoring **70%+ on a quiz**, OR
- The user is a parent (parents always have access for previewing), OR
- `?demo=1` is in the URL

The gate modal shows current progress (e.g. "1 / 3 topics today") and a button to open a lesson.

## ✅ Real parent dashboard
The Progress tab's weekly activity chart is **no longer fake** when a
child is linked. It now shows the linked student's actual:
- Daily topic + quiz activity (per-day bars)
- Total study minutes this week
- Lessons done this week
- Real day streak
- Latest exam result

The Dashboard tab gets a new **"Live data — your linked students"**
card with totals across all linked children.

## ✅ Topic-completion bug fix
The original `recordTopicComplete()` had an infinite recursion bug
that meant **topics were never being recorded as complete**. This is
why parent dashboards showed 0 topics even after lessons. Fixed:
- `recordTopicComplete` now correctly increments `topicsCompleted`
- Successfully completing a quiz (≥50% correct) now also bumps `topicsCompleted`
- All this syncs to Firestore for parents to see in real time

## ✅ Subject count consistency
Landing page used to claim 76 subjects in one place and 50+ in another.
Now consistently says "50+ subjects" and "1,800+ topics on syllabus"
(real numbers based on actual syllabus data in the code).

## What's still local-only (not wired to Firebase yet)
- Live multiplayer arena games still use bot opponents
- Direct messages between students
- Lobby chat in arena rooms
- Spectator chat

These are the next major build. They need realtime listeners,
matchmaking, and presence — about a day's focused work.
