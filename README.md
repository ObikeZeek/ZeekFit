# ZeekFit

Clean rebuild of the ZeekFit bodyweight-training PWA.

## Rebuild goals
- Local calendar date is the source of truth; no UTC date shifting.
- No Three.js, Mixamo, external 3D assets, or service-worker HTML injection.
- Workout plan, timers, progress, XP, streaks, weight check-in, and local reset remain available.
- Service worker caches the app shell without rewriting responses.

The original implementation remains on `main` as the reference/backup. The clean rebuild lives on `zeekfit-clean-rebuild` until it is promoted.