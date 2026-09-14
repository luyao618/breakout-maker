# NOCTURNE · luyao.blog cohost deployment

Public game: [luyao.blog/games/breakout/](https://luyao.blog/games/breakout/).

Latest recorded deployment: **2026-09-07 NOCTURNE**, source commit `4e6e0aa`, release `/opt/breakout-maker/releases/20260907-nocturne`. The previous frontend is `/opt/breakout-maker/releases/20260905-lu-yuan`. This installation uses host Nginx and a private systemd API service. The repository's Docker Compose setup is a separate topology.

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
- Persistent quota: `/var/lib/breakout-maker/trial-quota.json`, set by `QUOTA_STORE_PATH` in the private environment and retained through systemd `StateDirectory=breakout-maker`.
- Nginx include: `/etc/nginx/snippets/breakout-maker.conf`.
- Blog configuration backup: `/opt/breakout-maker/backups/blog.before-arcade.conf`.

## Build a new release

### Frontend-only updates

```sh
npm ci
VITE_BASE_PATH=/games/breakout/ npm run build -- --outDir dist-live
```

Stage `dist-live/` as a new release's `public/`. Copy the active release's `server/` directory unchanged, including its installed dependencies, so the next service start still uses the same API. Retain previous hashed static assets alongside the new assets so already-open tabs can finish loading them. Record the source commit, archive digest and previous release in `release.json` at the release root, outside `public/`.

Replace `current` atomically after staging. Frontend-only releases do not require an API restart or Nginx reload. Verify the new HTML/assets and compare the API PID, quota-file SHA256 and blog index/feed SHA256 with the values recorded before deployment.

### Updates that include backend code

In addition to the frontend build, compile the API:

```sh
npm --prefix server ci
npm --prefix server run build
```

Stage `server/dist/`, `server/package.json` and `server/package-lock.json` as the new release's `server/`. On the server, install production dependencies using the dedicated Node runtime. Keep credentials in `/etc/breakout-maker.env` and quota storage outside the release directory. After atomic activation, restart `breakout-maker.service` and verify private and public health endpoints.

`activate-cohost.sh` is only the initial route-integration helper: it backs up and validates the existing blog configuration before reloading Nginx. Routine releases do not need to run it.

### Alternative deployment files

The root [Dockerfile](../Dockerfile) builds the current frontend and API together; the [README](../README.md) includes a container command with persistent quota storage. The existing `docker-compose.yml`, `deploy.sh`, `update.sh` and `setup-ssl.sh` target a separate Docker/SSL installation, not this blog cohost layout. Do not use those scripts to update this installation.

The existing Compose file does not mount a quota data volume, and its Nginx container is outside Express's loopback proxy trust boundary. Persistent quota storage and trusted client-IP forwarding need configuring before using that topology for the shared trial service; see [server/README.md](../server/README.md).

## Verify

```sh
systemctl is-active breakout-maker nginx
curl --fail http://127.0.0.1:3107/api/health
curl --fail https://luyao.blog/games/breakout/api/health
curl -I https://luyao.blog/
curl -I https://luyao.blog/feed.xml
```

Check the game in a browser, including launch, pause/restart, sound toggle, E-key skill and mobile controls. Read `/api/generation-quota` to check API integration without spending an attempt. When validating generation itself, use a designated test IP or personal key: accepted shared requests consume quota even when the provider fails. The generation endpoint is rate-limited at Nginx and processes one generation at a time to fit the 1 GB VPS.

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

Each client IP gets three lifetime attempts. Accepted shared requests reserve an attempt durably before generation; template hits and provider failures count. Invalid requests and local concurrency rejections before reservation do not count; upstream busy errors after reservation do. Quota records are salted hashes of canonical IPs in `/var/lib/breakout-maker/trial-quota.json`. `StateDirectory=breakout-maker` keeps this file across service restarts and code releases. Do not delete it when deploying or rolling back.

Nginx overwrites `X-Forwarded-For` with its actual client address. Express trusts only loopback proxies. The quota read endpoint is excluded from the short-term burst limiter.

Visitors can supply their own SiliconFlow key after exhaustion (or earlier). It is used only for that request, not persisted or logged, and never falls back to the shared key. Personal requests keep shared usage unchanged; rate and concurrency protections still apply. The UI offers Kolors and Qwen-Image for personal keys.

When rolling back this release, keep the quota-enforcing backend or temporarily disable generation. Rolling back to a pre-quota API would remove the requested usage boundary.

Current campaign content consists of twelve tactical layouts and the preserved stage 13 dedication. All stages are freely available. During active play, pickup/status notifications occupy the page header on every viewport, with no in-field notification text or pickup bursts.

## Historical deployment records

The dated records below describe the state verified at each release, including observed process IDs and checksum comparisons. Inspect the server before the next deployment to establish a fresh baseline.

### Tactical campaign release — 2026-09-05

Frontend-only release: `/opt/breakout-maker/releases/20260905-tactical`. Backend files were copied unchanged from the previous quota-capable release; the API was not restarted. Previous release `/opt/breakout-maker/releases/20260905-top-hud` remains available for an atomic symlink rollback. All existing hashed assets are retained for already-open tabs.

The 13-stage campaign now uses bounded powers and armor/reactor/accelerator bricks. Numeric difficulty levels and route briefings are included in each stage; all stages remain unlocked. `tools/balance-calibration.md` records baseline and new synthetic-controller results.

After activation, API PID remained 538453 with 0 restarts. Trial state and blog index/feed SHA256 matched their predeploy values exactly. No environment variables, keys, quota records, Nginx configuration, blog files or service definitions changed.

### Restored personal dedication — 2026-09-05

Frontend release: `/opt/breakout-maker/releases/20260905-lu-yuan`; previous release: `/opt/breakout-maker/releases/20260905-tactical`. Stage13 restores the original 鹿原加油 / 必胜 text bitmap, HP and starting parameters from `09cc7ac`, with the modern engine and a “彩蛋” selection label. Stages1–12 remain byte-for-byte unchanged. The canonical bitmap lives in `levels/preserved/lu-yuan-easter-egg.json`; campaign generation reads it instead of designing a replacement.

This remains a frontend-only deployment. Backend files are copied unchanged and the API is not restarted. Old hashed assets, the blog and persistent quota state are preserved.

### NOCTURNE release — 2026-09-07

Release directory: `/opt/breakout-maker/releases/20260907-nocturne`.
Previous release: `/opt/breakout-maker/releases/20260905-lu-yuan`.

This is a frontend-only release of the centered lunar arena, mechanical paddle and smoothed pointer controls. Build with `VITE_BASE_PATH=/games/breakout/`, copy the previous release's server directory unchanged, and retain its hashed assets alongside the new bundle. Store the source commit, archive digest and previous release in `release.json` at the release root, outside `public/`.

Activate by replacing `/opt/breakout-maker/current` atomically. The API process does not need to restart. Verify public HTML/assets and API health, then compare API PID, quota-file SHA256 and blog index/feed SHA256 with their predeploy values.

To restore the previous frontend without restarting the API:

```sh
ln -sfn /opt/breakout-maker/releases/20260905-lu-yuan /opt/breakout-maker/current.rollback
mv -Tf /opt/breakout-maker/current.rollback /opt/breakout-maker/current
```
