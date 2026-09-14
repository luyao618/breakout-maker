# Breakout Maker generation API

Express + TypeScript service for NOCTURNE's Create mode. Campaign and local image conversion work without this service. The frontend setup is documented in the [project README](../README.md).

## Run locally

Use Node.js 22.12 or a newer 22.x release. From this directory:

```sh
npm ci
cp .env.example .env
# Configure IMAGE_API_KEY or LLM_API_KEY in .env.
npm run dev
```

Vite serves the game on port 5173 and proxies `/api` to port 3001. Changing `PORT` also requires changing the development proxy in `vite.config.ts`. To compile and run the API without watch mode:

```sh
npm run build
npm start
```

## Configuration

| Variable | Default / behavior |
| --- | --- |
| `IMAGE_API_KEY` | Shared image-provider key; takes precedence over `LLM_API_KEY` |
| `LLM_API_KEY` | Fallback shared key; configure at least one of these two variables before starting the service |
| `IMAGE_API_URL` | `https://api.siliconflow.cn/v1/images/generations` |
| `IMAGE_MODEL` | `Kwai-Kolors/Kolors` |
| `HOST` | `0.0.0.0`; the blog cohost service sets `127.0.0.1` |
| `PORT` | `3001`; the blog cohost service sets `3107` |
| `QUOTA_STORE_PATH` | `server/data/trial-quota.json`, resolved relative to the server module; use persistent storage in production |

The service requires a configured shared key at startup even if a visitor plans to use a personal key. Provider pricing and availability are controlled by SiliconFlow.

## API

All endpoints are under `/api` and return JSON with `Cache-Control: no-store`. For the live subpath deployment, prefix them with `/games/breakout`.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/api/health` | Returns `status: "ok"` and a timestamp; does not call the image provider |
| `GET` | `/api/generation-quota` | Returns `limit`, `used`, `remaining`, `defaultModel` and supported personal-key `models` |
| `POST` | `/api/generate-level` | Accepts a prompt and optional personal credentials; returns level fields plus `quota` and `usingOwnKey` |

Shared generation request:

```json
{ "prompt": "紫色水母" }
```

The trimmed prompt must contain 1–140 characters. Optional `apiKey` selects personal-key mode; optional `model` is accepted only with that key and must be `Kwai-Kolors/Kolors` or `Qwen/Qwen-Image`. JSON request bodies are limited to 2 KB. Responses expose the level directly, rather than nesting it under a `level` field.

Shared requests first try built-in templates. Otherwise the server requests an image, samples it with Sharp into a 56×40 grid, and converts it to colored bricks. Personal-key requests always use image generation. Both paths return a playable level preview.

## Quota and request behavior

- Each canonical client IP receives three lifetime shared attempts. The store keeps salted IP hashes, persists each reservation before generation and survives restarts when its file is retained.
- Template hits and provider failures consume accepted shared attempts. Invalid requests and requests rejected for local concurrency before reservation do not. A provider-side busy response after reservation still consumes the attempt.
- The service accepts one generation at a time. Local concurrency returns `429 / BUSY`; exhausted shared quota returns `403 / TRIAL_EXHAUSTED`; unavailable quota storage fails closed.
- Personal-key requests leave shared usage unchanged and never fall back to the shared key. They still use the service's concurrency and storage checks. Keys are not persisted or logged by the service.
- The frontend keeps a personal key only in its mounted Create dialog and sends it to the backend with each request. Closing the dialog clears that UI state; an already accepted request may still finish upstream.

Express trusts forwarded client addresses only from loopback proxies. The live Nginx configuration overwrites `X-Forwarded-For` with the actual client address. A proxy in a separate container is a different topology and needs an explicit trusted-proxy design to preserve per-client quotas.

## Serving the frontend and persisting data

In development, use Vite for the frontend. Express serves the repository-level `public/` directory, which only contains source static assets until a deployment copies the built frontend there. The root Dockerfile builds Vite's `dist/` and copies it to `/app/public`; the root README's Docker command mounts `/app/server/data` as a named volume.

For the live blog deployment, Nginx serves static files and Express runs privately. Set `QUOTA_STORE_PATH=/var/lib/breakout-maker/trial-quota.json` in the private service environment; systemd's `StateDirectory=breakout-maker` retains that directory across releases. Follow [deploy/COHOST.md](../deploy/COHOST.md) for release and rollback procedures.

The existing quota regression suite runs from the repository root with `npm test`. It exercises the API with a fixture generator and does not validate live provider availability.
