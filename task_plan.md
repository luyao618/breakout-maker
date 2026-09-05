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
Open the verified production preview for the user.

## Design decisions
- Palette: void #090b16, titanium #81869e, pearl #edf0ff, lavender #b7a1ff, ion #8ee7f0, ember #f8b78c.
- Display: locally bundled Space Grotesk; Chinese/body: system PingFang SC; labels: locally bundled JetBrains Mono.
- Signature: a physical levitating breakout instrument, with luminous ceramic/crystal bricks and machined metal edges.
- Layout: spacious observatory lobby, focused play surface, three genuine game modes.
- Original `.impeccable.md` provides accessibility/product context; user explicitly authorizes replacing its old visual implementation.

## Errors
- Goal creation reported an existing active goal; verified the existing goal already matches this request.
- Browser test helper `wait` became stuck after an HMR component replacement during upload; isolated final browser checks from editing, stopped only the task-owned stalled daemon, and created a fresh QA session.
