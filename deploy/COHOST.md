# luyao.blog cohost deployment

Public game: https://luyao.blog/games/breakout/

## SSH connection

Use the dedicated VPS key on the deployment machine:

```sh
ssh -i ~/work/files/ssh/ZGO-VPS-SSH-KEY \
  -o IdentitiesOnly=yes root@38.175.199.165
```

The key is stored outside the repository. Do not copy its contents into Git, release archives, or server public directories.

The blog remains rooted at `/var/www/blog`. Only dedicated `/games/breakout/` locations are included in the existing HTTPS virtual host. Nginx serves the game directly; only its `/api/` requests reach the private generation service.

## Layout

- Runtime: `/opt/breakout-maker/runtime/node` (verified Node 22.23.2 Linux x64).
- Versioned releases: `/opt/breakout-maker/releases/<release-id>/{public,server}`.
- Active release symlink: `/opt/breakout-maker/current`.
- Static symlink: `/var/www/games/breakout` → active release `/public`.
- API: `breakout-maker.service`, listening on `127.0.0.1:3107` only.
- Private API configuration: `/etc/breakout-maker.env`, root-only, excluded from Git and public files.
- Nginx include: `/etc/nginx/snippets/breakout-maker.conf`.
- Blog configuration backup: `/opt/breakout-maker/backups/blog.before-arcade.conf`.

## Build a new release

```sh
npm ci
VITE_BASE_PATH=/games/breakout/ npm run build -- --outDir dist-live
npm --prefix server ci
npm --prefix server run build
```

Stage `dist-live/` as a new release's `public/`, and `server/dist/`, `server/package.json`, `server/package-lock.json` as `server/`. On the server, run the dedicated runtime's `npm ci --omit=dev` in that release's server directory. Keep previous hashed static assets available when updating so already-open tabs can finish loading them.

Switch `current` atomically to the new release, restart `breakout-maker.service`, and verify its health before changing Nginx. `activate-cohost.sh` is the initial integration helper; it backs up and validates the existing blog configuration before gracefully reloading Nginx. Do not run the old `deploy/update.sh`: that script targets a different deployment layout.

## Verify

```sh
systemctl is-active breakout-maker nginx
curl --fail http://127.0.0.1:3107/api/health
curl --fail https://luyao.blog/games/breakout/api/health
curl -I https://luyao.blog/
curl -I https://luyao.blog/feed.xml
```

Check the game in a browser, including sound toggle, E-key skill, mobile controls and a generated level. The generation endpoint is rate-limited at Nginx and processes one generation at a time to fit the 1 GB VPS.

## Roll back

To roll back, use a release that still enforces the persistent quota. Do not restore the pre-quota generation API; if its frontend is needed, keep the quota-enforcing API or temporarily disable generation. Never remove the usage state file.

To remove the game routes and return to the original blog configuration:

```sh
cp -p /opt/breakout-maker/backups/blog.before-arcade.conf /etc/nginx/sites-available/blog
nginx -t && systemctl reload nginx
systemctl disable --now breakout-maker.service
```

No blog files, posts, feed, TLS certificate or DNS records need to change.

## Shared generation allowance

The generation API retains the persistent quota implementation. The shared model is `Kwai-Kolors/Kolors`, listed as free on SiliconFlow's official pricing page when checked on 2026-09-05. The service key stays in `/etc/breakout-maker.env` and is never part of the frontend bundle.

Each client IP gets three lifetime attempts. Valid accepted generation requests reserve an attempt durably before generation; provider failures count, malformed/busy requests do not. Quota records are salted hashes of canonical IPs in `/var/lib/breakout-maker/trial-quota.json`. `StateDirectory=breakout-maker` keeps this file across service restarts and code releases. Do not delete it when deploying or rolling back.

Nginx overwrites `X-Forwarded-For` with its actual client address. Express trusts only loopback proxies. The quota read endpoint is excluded from the short-term burst limiter.

Visitors can supply their own SiliconFlow key after exhaustion (or earlier). It is used only for that request, not persisted or logged, and never falls back to the shared key. Personal requests keep shared usage unchanged; rate and concurrency protections still apply. The UI offers Kolors and Qwen-Image for personal keys.

When rolling back this release, keep the quota-enforcing backend or temporarily disable generation. Rolling back to a pre-quota API would remove the requested usage boundary.

The campaign update only switches the static release. The running quota API, its service key and the persistent trial state are unchanged. All 13 redesigned campaign levels are freely available, and pickup/status notifications occupy the existing page header on every viewport, with no in-field text or pickup bursts.

## Tactical campaign release — 2026-09-05

Frontend-only release: `/opt/breakout-maker/releases/20260905-tactical`. Backend files were copied unchanged from the previous quota-capable release; the API was not restarted. Previous release `/opt/breakout-maker/releases/20260905-top-hud` remains available for an atomic symlink rollback. All existing hashed assets are retained for already-open tabs.

The 13-stage campaign now uses bounded powers and armor/reactor/accelerator bricks. Numeric difficulty levels and route briefings are included in each stage; all stages remain unlocked. `tools/balance-calibration.md` records baseline and new synthetic-controller results.

After activation, API PID remained 538453 with 0 restarts. Trial state and blog index/feed SHA256 matched their predeploy values exactly. No environment variables, keys, quota records, Nginx configuration, blog files or service definitions changed.

## Restored personal dedication — 2026-09-05

Frontend release: `/opt/breakout-maker/releases/20260905-lu-yuan`; previous release: `/opt/breakout-maker/releases/20260905-tactical`. Stage13 restores the original 鹿原加油 / 必胜 text bitmap, HP and starting parameters from `09cc7ac`, with the modern engine and a “彩蛋” selection label. Stages1–12 remain byte-for-byte unchanged. The canonical bitmap lives in `levels/preserved/lu-yuan-easter-egg.json`; campaign generation reads it instead of designing a replacement.

This remains a frontend-only deployment. Backend files are copied unchanged and the API is not restarted. Old hashed assets, the blog and persistent quota state are preserved.

## NOCTURNE release — 2026-09-07

Release directory: `/opt/breakout-maker/releases/20260907-nocturne`.
Previous release: `/opt/breakout-maker/releases/20260905-lu-yuan`.

This is a frontend-only release of the centered lunar arena, mechanical paddle and smoothed pointer controls. Build with `VITE_BASE_PATH=/games/breakout/`, copy the previous release's server directory unchanged, and retain its hashed assets alongside the new bundle. Store the source commit, archive digest and previous release in `release.json` at the release root, outside `public/`.

Activate by replacing `/opt/breakout-maker/current` atomically. The API process does not need to restart. Verify public HTML/assets and API health, then compare API PID, quota-file SHA256 and blog index/feed SHA256 with their predeploy values.

To restore the previous frontend without restarting the API:

```sh
ln -sfn /opt/breakout-maker/releases/20260905-lu-yuan /opt/breakout-maker/current.rollback
mv -Tf /opt/breakout-maker/current.rollback /opt/breakout-maker/current
```
