import Redis from 'ioredis';
import { config } from './index';

let redis: Redis;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    redis.on('connect', () => console.log('Redis connected.'));
    redis.on('error', (err) => console.error('Redis error:', err));
  }
  return redis;
}

export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const r = getRedis();
  await r.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function getCache<T>(key: string): Promise<T | null> {
  const r = getRedis();
  const data = await r.get(key);
  return data ? JSON.parse(data) : null;
}

export async function clearCache(pattern: string): Promise<void> {
  const r = getRedis();
  const keys = await r.keys(pattern);
  if (keys.length > 0) await r.del(...keys);
}
