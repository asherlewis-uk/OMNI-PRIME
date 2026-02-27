// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE CONNECTION - Redis Connection Management for BullMQ
// ═══════════════════════════════════════════════════════════════════════════════

import { Redis } from "ioredis";
import type { RedisOptions } from "ioredis";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? "6379", 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION STATE
// ═══════════════════════════════════════════════════════════════════════════════

let redisConnection: Redis | null = null;
let redisPublisher: Redis | null = null;
let redisSubscriber: Redis | null = null;
let isShuttingDown = false;

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse Redis URL or use individual config.
 */
function getRedisConfig():
  | { url: string; options?: never }
  | { url?: never; options: RedisOptions } {
  if (REDIS_URL && REDIS_URL !== "redis://localhost:6379") {
    return { url: REDIS_URL };
  }

  return {
    options: {
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false, // Required for BullMQ
    },
  };
}

/**
 * Create a new Redis connection with error handling.
 */
function createRedisConnection(): Redis {
  const config = getRedisConfig();

  const redis = config.url
    ? new Redis(config.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      })
    : new Redis(config.options!);

  // Event handlers
  redis.on("connect", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Redis connected");
    }
  });

  redis.on("ready", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Redis ready");
    }
  });

  redis.on("error", (error) => {
    if (!isShuttingDown) {
      console.error("❌ Redis error:", error.message);
    }
  });

  redis.on("close", () => {
    if (!isShuttingDown && process.env.NODE_ENV === "development") {
      console.log("⚠️  Redis connection closed");
    }
  });

  redis.on("reconnecting", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔄 Redis reconnecting...");
    }
  });

  return redis;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION GETTERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the main Redis connection for BullMQ.
 */
export function getRedisConnection(): Redis {
  if (!redisConnection || redisConnection.status === "end") {
    redisConnection = createRedisConnection();
  }
  return redisConnection;
}

/**
 * Get a Redis connection for publishing.
 */
export function getRedisPublisher(): Redis {
  if (!redisPublisher || redisPublisher.status === "end") {
    redisPublisher = createRedisConnection();
  }
  return redisPublisher;
}

/**
 * Get a Redis connection for subscribing.
 */
export function getRedisSubscriber(): Redis {
  if (!redisSubscriber || redisSubscriber.status === "end") {
    redisSubscriber = createRedisConnection();
  }
  return redisSubscriber;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if Redis is connected.
 */
export function isRedisConnected(): boolean {
  return redisConnection?.status === "ready";
}

/**
 * Ping Redis to verify connectivity.
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

/**
 * Get Redis server info.
 */
export async function getRedisInfo(): Promise<Record<string, string> | null> {
  try {
    const redis = getRedisConnection();
    const info = await redis.info();
    const lines = info.split("\r\n");
    const result: Record<string, string> = {};

    for (const line of lines) {
      if (line.includes(":")) {
        const [key, value] = line.split(":");
        if (key && value) {
          result[key] = value;
        }
      }
    }

    return result;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Close all Redis connections gracefully.
 */
export async function closeRedisConnections(): Promise<void> {
  isShuttingDown = true;

  const closeConnection = async (redis: Redis | null, name: string) => {
    if (redis && redis.status !== "end") {
      try {
        await redis.quit();
        if (process.env.NODE_ENV === "development") {
          console.log(`✅ Redis ${name} connection closed`);
        }
      } catch (error) {
        console.error(`❌ Error closing Redis ${name}:`, error);
      }
    }
  };

  await Promise.all([
    closeConnection(redisConnection, "main"),
    closeConnection(redisPublisher, "publisher"),
    closeConnection(redisSubscriber, "subscriber"),
  ]);

  redisConnection = null;
  redisPublisher = null;
  redisSubscriber = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESS HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

process.on("SIGINT", async () => {
  await closeRedisConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeRedisConnections();
  process.exit(0);
});

process.on("beforeExit", async () => {
  await closeRedisConnections();
});
