import { redisClient } from '../config/redis';

const cacheTags = new Map<string, Set<string>>();

/**
 * Cache utility for bounded reads with tag-based invalidation (PDF Section 10)
 */
export const getOrSetCache = async <T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
  tag?: string
): Promise<T> => {
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    // Gracefully proceed on cache miss/error
  }

  const freshData = await fetchFn();

  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(freshData));
    if (tag) {
      if (!cacheTags.has(tag)) {
        cacheTags.set(tag, new Set());
      }
      cacheTags.get(tag)!.add(key);
    }
  } catch (err) {
    // Non-fatal cache write failure
  }

  return freshData;
};

/**
 * Invalidate all caches associated with an entity tag
 */
export const invalidateTag = async (tag: string): Promise<void> => {
  const keys = cacheTags.get(tag);
  if (!keys || keys.size === 0) return;

  const keyList = Array.from(keys);
  cacheTags.delete(tag);

  await Promise.all(
    keyList.map((k) => redisClient.del(k).catch(() => {}))
  );
};
