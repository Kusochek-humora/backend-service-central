import Redis from "ioredis";

let client: Redis | null = null;

function getClient(): Redis | null {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = new Redis(url, { lazyConnect: true, enableReadyCheck: false, maxRetriesPerRequest: 1 });
  client.on("error", () => {});
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = getClient();
    if (!r) return null;
    const val = await r.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    const r = getClient();
    if (!r) return;
    await r.set(key, JSON.stringify(value), "EX", ttl);
  } catch {}
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const r = getClient();
    if (!r) return;
    let cursor = "0";
    do {
      const [next, keys] = await r.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = next;
      if (keys.length > 0) await r.del(...keys);
    } while (cursor !== "0");
  } catch {}
}

export function cacheKey(prefix: string, params: object = {}): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return sorted.length ? `${prefix}:${JSON.stringify(sorted)}` : prefix;
}
