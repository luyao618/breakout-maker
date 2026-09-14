# NOCTURNE visual contract

NOCTURNE pairs midnight nebulae, moonlight and crystalline bricks with precision metal hardware and controlled bloom. Stable symmetry and readable materials define its visual identity.

This is the current play-scene contract. Audience, typography and accessibility guidance live in [the project design guidelines](../.impeccable.md); gameplay feedback lives in [arcade-direction.md](arcade-direction.md). Earlier perspective/studio experiments are historical, not additional supported play modes.

- Palette: abyss #050815, midnight #101b39, moon #cedcff, ion #73e5ff, aether #a68aff, champagne #f2c78f.
- Type: bundled Space Grotesk and JetBrains Mono; PingFang/system Chinese body.
- The playing court is centered and horizontally symmetrical. No camera yaw, roll, shake, pointer parallax or automatic camera motion during play.
- The paddle is precision hardware, authored in LunarPaddle.tsx. Its position comes from the smoothed physics body. Never add renderer-only follow lag, tilting, bobbing or position noise.
- The recessed paddle core indicates power state. Dim backgrounds, controlled reflection and restrained bloom keep the actual ball brightest and easy to locate.
- The world can be rich; controls stay quiet and compact. Pickup/timer notifications remain above the court on every viewport.
- All 13 current campaign layouts and the protected Lu Yuan dedication remain intact. Runtime presentation/paddle tuning belongs in the modern adapter; these layouts should not be confused with the historical pre-redesign campaign.
- Procedural assets and shaders are local; no background image service or external asset URL is required.

## Implementation map

| Area | Source |
| --- | --- |
| Court, moon and environment | [components/LunarCourt.tsx](components/LunarCourt.tsx) |
| Mechanical paddle and state lighting | [components/LunarPaddle.tsx](components/LunarPaddle.tsx) |
| Fixed perspective and pointer projection | [game/camera.ts](game/camera.ts), [components/ArenaInput.tsx](components/ArenaInput.tsx) |
| Shared model/collider position and pointer smoothing | [game/engine.ts](game/engine.ts) |
| Full-height play layout and colors | [arcade.css](arcade.css) |
| Lobby/base styles | [styles.css](styles.css) |
| Reference screenshots | [Desktop](../screenshots/nocturne-desktop.png), [mobile](../screenshots/nocturne-mobile.png), [paddle detail](../screenshots/lunar-paddle-detail.png) |

The camera adapts between 52° desktop and 62° portrait elevation when the viewport changes; it does not move in response to gameplay. NOCTURNE uses 90% of each level's authored paddle width, height 16 and center y=605 in the 375×667 logical board. Serve position, rendering and collision follow that body. Pointer smoothing runs at the fixed simulation step; keyboard movement takes over directly.

The lobby still contains Astral naming and its own showcase camera. Existing sound-preference storage keys also retain that name. Neither is a reason to restore the earlier play layout or palette.
