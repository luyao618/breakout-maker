# luyao.blog cohost deployment

Public game: https://luyao.blog/games/breakout/

The blog remains rooted at `/var/www/blog`. Only dedicated `/games/breakout/` locations are included in the existing HTTPS virtual host. Nginx serves the game directly; only its `/api/` requests reach the private generation service.

## Layout

- Runtime: `/opt/breakout-maker/runtime/node` (verified Node 22.23.2 Linux x64).
- Versioned release: `/opt/breakout-maker/releases/20260905-top-hud/{public,server}`.
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

The current release is `/opt/breakout-maker/releases/20260905-top-hud`; its generation API retains the persistent quota implementation. The shared model is `Kwai-Kolors/Kolors`, listed as free on SiliconFlow's official pricing page when checked on 2026-09-05. The service key stays in `/etc/breakout-maker.env` and is never part of the frontend bundle.

Each client IP gets three lifetime attempts. Valid accepted generation requests reserve an attempt durably before generation; provider failures count, malformed/busy requests do not. Quota records are salted hashes of canonical IPs in `/var/lib/breakout-maker/trial-quota.json`. `StateDirectory=breakout-maker` keeps this file across service restarts and code releases. Do not delete it when deploying or rolling back.

Nginx overwrites `X-Forwarded-For` with its actual client address. Express trusts only loopback proxies. The quota read endpoint is excluded from the short-term burst limiter.

Visitors can supply their own SiliconFlow key after exhaustion (or earlier). It is used only for that request, not persisted or logged, and never falls back to the shared key. Personal requests keep shared usage unchanged; rate and concurrency protections still apply. The UI offers Kolors and Qwen-Image for personal keys.

When rolling back this release, keep the quota-enforcing backend or temporarily disable generation. Rolling back to a pre-quota API would remove the requested usage boundary.

The campaign update only switches the static release. The running quota API, its service key and the persistent trial state are unchanged. All 13 redesigned campaign levels are freely available, and pickup/status notifications occupy the existing page header on every viewport, with no in-field text or pickup bursts.
