// 轻量内存 TTL 缓存：适合低变更、计算成本较高的只读数据（如税务计算）
export function createTTLCache<T>(ttlMs: number, maxSize = 200) {
  const store = new Map<string, { value: T; expiresAt: number }>();
  return {
    get(key: string): T | undefined {
      const item = store.get(key);
      if (!item) return undefined;
      if (Date.now() > item.expiresAt) { store.delete(key); return undefined; }
      return item.value;
    },
    set(key: string, value: T): void {
      if (store.size >= maxSize) { const first = store.keys().next().value; if (first !== undefined) store.delete(first); }
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    invalidate(key: string): void { store.delete(key); },
    clear(): void { store.clear(); },
  };
}
