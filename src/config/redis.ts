import { createClient, RedisClientType } from 'redis';
import { config } from './index';

let isRedisConnected = false;
const inMemoryStore = new Map<string, { value: string; expiresAt: number }>();

export class RedisUnavailableError extends Error {
  constructor(message = 'Authoritative Redis service is temporarily unavailable') {
    super(message);
    this.name = 'RedisUnavailableError';
  }
}

const realRedisClient = createClient({
  url: config.redis.url,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries >= 3) {
        return false;
      }
      return 1000;
    },
  },
});

let errorLogged = false;

realRedisClient.on('error', () => {
  isRedisConnected = false;
  if (!errorLogged && config.nodeEnv !== 'test') {
    console.warn('⚠️ Redis server connection error. Strict authoritative operations will fail safely.');
    errorLogged = true;
  }
});

realRedisClient.on('connect', () => {
  isRedisConnected = true;
  errorLogged = false;
  if (config.nodeEnv !== 'test') {
    console.log('✅ Redis Client Connected');
  }
});

export const connectRedis = async (): Promise<void> => {
  try {
    if (!realRedisClient.isOpen) {
      await realRedisClient.connect();
    }
  } catch (error) {
    isRedisConnected = false;
  }
};

export const getRawRedisClient = (): RedisClientType => realRedisClient as RedisClientType;

class RedisService {
  isAvailable(): boolean {
    return isRedisConnected && realRedisClient.isOpen;
  }

  async setEx(key: string, seconds: number, value: string, requireAuthoritative = false): Promise<string> {
    if (this.isAvailable()) {
      try {
        await realRedisClient.setEx(key, seconds, value);
        return 'OK';
      } catch (err) {
        if (requireAuthoritative) {
          throw new RedisUnavailableError('Failed to persist to authoritative Redis store');
        }
      }
    }

    if (requireAuthoritative) {
      throw new RedisUnavailableError();
    }

    // Process-local fallback ONLY permitted for non-security caches
    inMemoryStore.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async get(key: string, requireAuthoritative = false): Promise<string | null> {
    if (this.isAvailable()) {
      try {
        return await realRedisClient.get(key);
      } catch (err) {
        if (requireAuthoritative) {
          throw new RedisUnavailableError('Failed to read from authoritative Redis store');
        }
      }
    }

    if (requireAuthoritative) {
      throw new RedisUnavailableError();
    }

    const item = inMemoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      inMemoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async del(key: string): Promise<number> {
    if (this.isAvailable()) {
      try {
        return await realRedisClient.del(key);
      } catch (err) {
        // Fall through to clear memory store
      }
    }
    const existed = inMemoryStore.has(key);
    inMemoryStore.delete(key);
    return existed ? 1 : 0;
  }

  /**
   * Atomic single-use retrieval and deletion (PDF Section 9)
   */
  async getDel(key: string, requireAuthoritative = false): Promise<string | null> {
    if (this.isAvailable()) {
      try {
        // Redis 6.2+ native GETDEL command
        const val = await (realRedisClient as any).getDel(key);
        return val ?? null;
      } catch (err) {
        if (requireAuthoritative) {
          throw new RedisUnavailableError('Failed to atomically consume key from Redis');
        }
      }
    }

    if (requireAuthoritative) {
      throw new RedisUnavailableError();
    }

    const item = inMemoryStore.get(key);
    if (!item) return null;
    inMemoryStore.delete(key);
    if (Date.now() > item.expiresAt) {
      return null;
    }
    return item.value;
  }

  /**
   * Atomic increment for attempt tracking
   */
  async incr(key: string, requireAuthoritative = false): Promise<number> {
    if (this.isAvailable()) {
      try {
        return await realRedisClient.incr(key);
      } catch (err) {
        if (requireAuthoritative) {
          throw new RedisUnavailableError('Failed to increment attempt counter in Redis');
        }
      }
    }

    if (requireAuthoritative) {
      throw new RedisUnavailableError();
    }

    const item = inMemoryStore.get(key);
    const current = item ? parseInt(item.value, 10) || 0 : 0;
    const nextVal = current + 1;
    inMemoryStore.set(key, { value: String(nextVal), expiresAt: Date.now() + 600 * 1000 });
    return nextVal;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (this.isAvailable()) {
      try {
        return Boolean(await realRedisClient.expire(key, seconds));
      } catch (err) {
        return false;
      }
    }
    const item = inMemoryStore.get(key);
    if (item) {
      item.expiresAt = Date.now() + seconds * 1000;
      return true;
    }
    return false;
  }
}

export const redisClient = new RedisService();
