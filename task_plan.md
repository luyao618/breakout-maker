# Astral Forge 3D rebuild

## Goal
Create a new React + TypeScript + Three.js edition on `codex/astral-forge-3d`, preserving the original breakout rules, 13 levels, image conversion, AI generation, powers, scoring, and progress.

## Current Phase
Complete

### Phase 1 — Audit and direction
**Status:** complete
- Inspected original rules, source, deployment and design context.
- Created branch; pre-existing `.omc/` and `screenshots/.originals/` remain untouched.

### Phase 2 — Engine and 3D presentation
**Status:** complete
- Modern module adapter for the proven original simulation.
- Real Three.js geometry, lighting, animated arena, impact effects.
- React interface with responsive Chinese-first controls.

### Phase 3 — Maker workflows and integration
**Status:** complete
- Image upload, AI generation and preview, persistence, audio, deployment.

### Phase 4 — Verification and polish
**Status:** complete
- Existing regression tests, new adapter coverage, typecheck and production build.
- Browser playtest and desktop/mobile visual review, address findings.

## Next Step
Restored 鹿原加油 / 必胜 dedication is live at https://luyao.blog/games/breakout/ as stage13. Preserve its canonical source in future campaign changes.

## Design decisions
- Palette: void #090b16, titanium #81869e, pearl #edf0ff, lavender #b7a1ff, ion #8ee7f0, ember #f8b78c.
- Display: locally bundled Space Grotesk; Chinese/body: system PingFang SC; labels: locally bundled JetBrains Mono.
- Signature: a physical levitating breakout instrument, with luminous ceramic/crystal bricks and machined metal edges.
- Layout: spacious observatory lobby, focused play surface, three genuine game modes.
- Original `.impeccable.md` provides accessibility/product context; user explicitly authorizes replacing its old visual implementation.

## Errors
- The restored 778-brick dedication exceeded the tactical campaign test’s 600-second cutoff. A longer control-only run cleared all three seeds in493–663s; preserve the original artwork/settings and allow1200 simulated seconds for this stage only.
- Difficulty pass: a pre-existing media-query spacing error surfaced during CSS minification; corrected and rebuilt without that warning. Immediate post-reload browser clicks ran before mount; waited for the next DOM snapshot, then verified controls.
- Goal creation reported an existing active goal; verified the existing goal already matches this request.
- Browser test helper `wait` became stuck after an HMR component replacement during upload; isolated final browser checks from editing, stopped only the task-owned stalled daemon, and created a fresh QA session.

### Phase 5 — Arcade feel and new player agency
**Status:** complete
- User explicitly authorizes gameplay enhancements; move beyond the prior presentation-only rebuild.
- Add charged Supernova ability, more rewarding drop cadence, event-driven 3D impacts and power effects.
- Replace flat sounds with spatial, layered procedural audio; retain mute and make music opt-in.
- Recompose the play page as an immersive luminous reactor with meaningful combo/ability/pickup HUD.
- Verify actual playing, power activation, audio routing, pause/restart and mobile controls.

### Phase 6 — Deploy alongside the existing blog
**Status:** complete
- User authorized SSH deployment to 38.175.199.165 using the provided key, preserving luyao.blog.
- Inspect existing nginx/blog and use the existing HTTPS certificate with a dedicated /games/breakout/ path.
- Build locally, stage a versioned release, configure a separate loopback API process, back up nginx config, validate before reload.
- Verify live game assets/API and unchanged blog endpoints; keep rollback instructions.

### Phase 7 — Shared API trial quota and personal keys
**Status:** complete
- User requests cheapest SiliconFlow image model and replaces the service key (secret must stay outside source, logs, public assets).
- Interpret 3 attempts/IP as a lifetime allowance, persisted across restarts/deployments; malformed/busy requests do not spend it.
- Enforce quota on server with trusted proxy IP handling; personal keys bypass shared quota, never fall back to shared credentials on errors.
- Add quota indicator and personal API key input; verify boundaries, spoof resistance, persistence, and redeploy without affecting the blog.

### Phase 8 — Clear mobile HUD and redesigned open campaign
**Status:** complete
- Move mobile pickup announcements and ongoing power timers into a reserved strip outside the playfield; protect the paddle/ball approach area.
- Redesign all 13 campaign layouts with richer geometry, entry channels and varied brick toughness, then test feasibility and mobile rendering.
- Remove campaign locks for fresh and existing players, including legacy saves.
- Redeploy while retaining server secrets, persistent IP trial usage and blog routing.

### Phase 9 — Universal top-header notifications
**Status:** complete
- Prior fix only hid in-field pickup overlays below 600px. Remove those elements structurally on all viewports.
- Move pickup messages and timed effects into the existing page header; no game geometry shift on collection.
- Remove pickup bursts/camera shake on all screens and move combo/pulse text out of the live playfield too.
- Verify portrait, landscape, tablet and desktop; redeploy frontend only, preserving API/quota/blog.

### Phase 10 — Tactical difficulty redesign
**Status:** complete
- Audit the feedback loop and capture untouched baseline simulation results.
- Rebuild the campaign around firing lanes, armor gates, reactor weak points and accelerator hazards.
- Bound multi-ball, penetration, life income and skill charge so aiming and survival matter.
- Compare control-only simulated skill tiers, retain expert feasibility checks and verify mobile presentation.
- Deploy frontend release without changing blog, API credentials, trial state, unlocked stages or header notifications.

### Phase 11 — Preserve Lu Yuan dedication
**Status:** complete
- Restore the original 鹿原加油 / 必胜 brick bitmap and starting settings, retaining the modern engine.
- Protect the authored dedication as a separate source asset that the campaign generator preserves.
- Keep stages 1–12 unchanged; verify playability and mobile text rendering, then deploy frontend only.
