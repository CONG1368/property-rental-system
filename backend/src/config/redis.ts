import Redis from 'ioredis';
import { config } from './index.js';

let redis: Redis | null = null;
let redisFailed = false;

export function getRedis(): Redis | null {
  if (!config.redis.enabled) return null;
  if (redisFailed) return null;
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: () => null, // 不重试
      connectTimeout: 2000,
    });

    redis.on('error', () => {
      redisFailed = true;
      redis?.disconnect();
      redis = null;
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  if (!config.redis.enabled) {
    console.log('[Redis] Disabled by config');
    return;
  }
  try {
    const r = getRedis();
    if (r) {
      await r.connect();
      console.log('[Redis] Connected');
    }
  } catch {
    console.log('[Redis] Not available, running without cache');
    redisFailed = true;
    redis = null;
  }
}

export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try { await r.setex(key, ttlSeconds, JSON.stringify(value)); } catch {}
}

export async function getCache<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const data = await r.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch { return null; }
}

export async function clearCache(pattern: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const keys = await r.keys(pattern);
    if (keys.length > 0) await r.del(...keys);
  } catch {}
}
