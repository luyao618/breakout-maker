import { createHash, randomBytes } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  existsSync,
  openSync,
  closeSync,
  fsyncSync,
} from "node:fs";
import { dirname } from "node:path";
import { isIP } from "node:net";

export interface QuotaState {
  limit: number;
  used: number;
  remaining: number;
}
interface StoreData {
  version: 1;
  salt: string;
  counts: Record<string, number>;
}

export function normalizeIp(value: string): string {
  const v = value.toLowerCase().trim();
  if (v.startsWith("::ffff:") && isIP(v.slice(7)) === 4) return v.slice(7);
  const version = isIP(v);
  if (version === 4) return v;
  if (version === 6) {
    const canonical = new URL(`http://[${v}]/`).hostname.slice(1, -1);
    const mapped = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/.exec(canonical);
    if (mapped) {
      const high = parseInt(mapped[1], 16),
        low = parseInt(mapped[2], 16);
      return [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
    }
    return canonical;
  }
  throw new Error("Invalid client address");
}

/** Single-process atomic reservations, stored outside versioned app releases. */
export class TrialQuotaStore {
  private data: StoreData;
  constructor(
    private readonly filePath: string,
    private readonly limit = 3,
  ) {
    if (existsSync(filePath)) {
      const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
      const obj = parsed as Partial<StoreData> | null;
      if (
        !obj ||
        obj.version !== 1 ||
        typeof obj.salt !== "string" ||
        !/^[a-f0-9]{64}$/.test(obj.salt) ||
        !obj.counts ||
        typeof obj.counts !== "object" ||
        Array.isArray(obj.counts) ||
        Object.entries(obj.counts).some(
          ([key, count]) =>
            !/^[a-f0-9]{64}$/.test(key) ||
            !Number.isInteger(count) ||
            count < 0 ||
            count > limit,
        )
      ) {
        throw new Error(
          "Trial quota database is invalid; refusing to reset usage",
        );
      }
      this.data = obj as StoreData;
    } else {
      this.data = {
        version: 1,
        salt: randomBytes(32).toString("hex"),
        counts: {},
      };
      this.persist(this.data);
    }
  }
  get(ip: string): QuotaState {
    const used = this.data.counts[this.key(ip)] ?? 0;
    return {
      limit: this.limit,
      used,
      remaining: Math.max(0, this.limit - used),
    };
  }
  consume(ip: string): QuotaState | null {
    const key = this.key(ip);
    const used = this.data.counts[key] ?? 0;
    if (used >= this.limit) return null;
    const next = {
      ...this.data,
      counts: { ...this.data.counts, [key]: used + 1 },
    };
    this.persist(next); // A failed disk write must never grant an unrecorded attempt.
    this.data = next;
    return this.get(ip);
  }
  private key(ip: string): string {
    return createHash("sha256")
      .update(this.data.salt + "\0" + normalizeIp(ip))
      .digest("hex");
  }
  private persist(data: StoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    const descriptor = openSync(temporary, "w", 0o600);
    try {
      writeFileSync(descriptor, JSON.stringify(data), "utf8");
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, this.filePath);
  }
}
