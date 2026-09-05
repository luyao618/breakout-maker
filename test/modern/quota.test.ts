import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { TrialQuotaStore, normalizeIp } from "../../server/src/trial-quota";
import { createApp } from "../../server/src/app";
import { ImageProviderError } from "../../server/src/generate-image";

const folders: string[] = [];
const servers: Server[] = [];
function store() {
  const dir = mkdtempSync(join(tmpdir(), "breakout-quota-test-"));
  folders.push(dir);
  const file = join(dir, "quota.json");
  return { quota: new TrialQuotaStore(file), file, dir };
}
const level = {
  name: "Test",
  gridWidth: 16,
  gridHeight: 8,
  ballSpeed: 280,
  paddleWidth: 100,
  lives: 5,
  bricks: [{ row: 0, col: 0, hp: 1 }],
};
async function serve(generator = vi.fn().mockResolvedValue(level)) {
  const data = store();
  const server = createServer(createApp({ quota: data.quota, generator }));
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  const base = `http://127.0.0.1:${addr.port}/api`;
  const post = (
    body: unknown,
    ip = "198.51.100.10",
    headers: Record<string, string> = {},
  ) =>
    fetch(base + "/generate-level", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  return { ...data, base, post, generator };
}
afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections();
    await new Promise<void>((r) => s.close(() => r()));
  }
  for (const d of folders.splice(0))
    rmSync(d, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("persistent shared trial quota", () => {
  it("allows exactly three reservations and retains them after restart without storing raw IPs", () => {
    const { quota, file } = store();
    for (let i = 1; i <= 3; i++)
      expect(quota.consume("192.0.2.17")).toEqual({
        limit: 3,
        used: i,
        remaining: 3 - i,
      });
    expect(quota.consume("192.0.2.17")).toBeNull();
    expect(new TrialQuotaStore(file).get("192.0.2.17").remaining).toBe(0);
    expect(readFileSync(file, "utf8")).not.toContain("192.0.2.17");
    expect(quota.get("192.0.2.18").remaining).toBe(3);
  });
  it("normalizes IPv4-mapped and equivalent IPv6 addresses", () => {
    const { quota } = store();
    quota.consume("192.0.2.17");
    expect(quota.get("::ffff:192.0.2.17").used).toBe(1);
    expect(quota.get("::ffff:c000:211").used).toBe(1);
    quota.consume("2001:db8:0:0:0:0:0:1");
    expect(quota.get("2001:db8::1").used).toBe(1);
    expect(() => normalizeIp("attacker-input")).toThrow();
  });
  it("fails closed instead of resetting corrupt state", () => {
    const { file } = store();
    writeFileSync(file, "broken");
    expect(() => new TrialQuotaStore(file)).toThrow();
  });
  it("does not grant an attempt when the durable write fails", () => {
    const { quota, file } = store();
    mkdirSync(`${file}.${process.pid}.tmp`);
    expect(() => quota.consume("192.0.2.1")).toThrow();
    expect(quota.get("192.0.2.1").used).toBe(0);
  });
});

describe("generation access boundary", () => {
  it("rejects the fourth trial before generation, with a personal-key action", async () => {
    const { post, generator } = await serve();
    for (let i = 0; i < 3; i++)
      expect((await post({ prompt: "castle" })).status).toBe(200);
    const denied = await post({ prompt: "castle" });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      code: "TRIAL_EXHAUSTED",
      requiresApiKey: true,
      quota: { remaining: 0 },
    });
    expect(generator).toHaveBeenCalledTimes(3);
  });
  it("counts provider failures, but not invalid requests or busy responses", async () => {
    const generator = vi.fn().mockRejectedValue(new ImageProviderError(500));
    const { post, quota } = await serve(generator);
    expect((await post({ prompt: "" })).status).toBe(400);
    expect((await post({ prompt: "x", apiKey: "bad" })).status).toBe(400);
    expect(quota.get("198.51.100.10").used).toBe(0);
    expect((await post({ prompt: "x" })).status).toBe(500);
    expect(quota.get("198.51.100.10").used).toBe(1);
  });
  it("uses only personal credentials after exhaustion and never falls back to the shared key", async () => {
    const { post, quota, generator } = await serve();
    for (let i = 0; i < 3; i++) quota.consume("198.51.100.10");
    const apiKey = "sk-personal-test-credential-123456789";
    generator.mockRejectedValueOnce(new ImageProviderError(401));
    const denied = await post({
      prompt: "moon",
      apiKey,
      model: "Qwen/Qwen-Image",
    });
    expect(denied.status).toBe(401);
    expect(await denied.json()).toMatchObject({
      code: "PERSONAL_KEY_REJECTED",
    });
    expect(generator).toHaveBeenCalledTimes(1);
    expect(generator).toHaveBeenLastCalledWith("moon", {
      apiKey,
      model: "Qwen/Qwen-Image",
    });
    expect(quota.get("198.51.100.10").used).toBe(3);
    const success = await post({ prompt: "moon", apiKey });
    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({ usingOwnKey: true });
  });
  it("does not allow callers to choose a costly shared model or arbitrary API endpoint", async () => {
    const { post, generator } = await serve();
    expect((await post({ prompt: "x", model: "Qwen/Qwen-Image" })).status).toBe(
      400,
    );
    expect(
      (
        await post({
          prompt: "x",
          apiKey: "sk-personal-test-credential-123456789",
          model: "http://127.0.0.1",
        })
      ).status,
    ).toBe(400);
    expect(generator).not.toHaveBeenCalled();
  });
  it("treats the nearest untrusted proxy address as the client, ignoring spoofed earlier hops", async () => {
    const { post, quota, base } = await serve();
    await post({ prompt: "x" }, "203.0.113.99, 198.51.100.23");
    expect(quota.get("198.51.100.23").used).toBe(1);
    expect(quota.get("203.0.113.99").used).toBe(0);
    const r = await fetch(base + "/generation-quota", {
      headers: { "X-Forwarded-For": "198.51.100.23" },
    });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toMatchObject({ remaining: 2 });
  });
  it("reserves before async generation and rejects concurrent work without consuming another attempt", async () => {
    let finish: (v: typeof level) => void = () => {};
    const pending = new Promise<typeof level>((r) => {
      finish = r;
    });
    const generator = vi.fn().mockImplementation(() => pending);
    const { post, quota } = await serve(generator);
    const first = post({ prompt: "one" });
    await vi.waitFor(() => expect(generator).toHaveBeenCalledTimes(1));
    const second = await post({ prompt: "two" });
    expect(second.status).toBe(429);
    expect(quota.get("198.51.100.10").used).toBe(1);
    finish(level);
    expect((await first).status).toBe(200);
  });
});
