# Progress

- 2026-09-05: audited repo, chose architecture and art direction, created new branch.
- Active goal verified; gameplay preservation and 3D presentation implementation underway.
- Engine adapter and 3D arena integrated; root React lobby, campaign picker, maker dialogs and responsive play HUD implemented.
- Production typecheck/build pass. Engine adapter has 14 passing tests.
- Legacy test baseline found three stale expectations (12 vs 13 levels, top-wall test hitting a brick); corrected fixtures without changing simulation, all 106 original tests now pass.
- Scoped Vitest to test/modern so standalone legacy runners are not run a second time inside Vitest.
- Browser QA started at http://localhost:5173, desktop target 1440×1050.
- Mobile lobby and gameplay screenshots verified at 390×844. Fixed flex sizing that collapsed the mobile showcase.
- Actual PNG upload produced a 2,182-brick image level, with successful preview and playable scene; no page errors.
- AI backend is not running locally; service failure stays in the dialog with retry available. Real external model generation is not claimed tested.
- Extracted Maker, ModalFrame and BrickPreview into dedicated typed components and added formatter commands.
- Final validation: 106 legacy tests + 16 modern adapter tests pass; TypeScript, production build, Prettier check and git diff --check pass.
- Production preview verified at 1440×1050, 768×1024 and 390×844, with no horizontal overflow or page errors. Tablet HUD was corrected to keep score/lives visible.
- Browser dispatched Space/Escape controls launch and pause correctly; paused score stays frozen. Pointer controls and full image flow verified separately.
- AI success flow verified with temporary local HTTP fixture, then fixture stopped. This verifies fetch/preview/play, not a real model call.
- Three rendering includes dynamic instance capacity, labeled drops and a verified functional Canvas fallback when WebGL is unavailable.
- Final screenshots saved in screenshots/astral-desktop.png and screenshots/astral-mobile-play.png. Production preview remains at http://localhost:4173.
- README and Dockerfile updated for the new Vite frontend; no external deployment. Docker image build remains unverified because the daemon is unavailable.
