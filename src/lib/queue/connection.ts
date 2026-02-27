// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE CONNECTION — Lazy Redis Connection Management for BullMQ
//
// Default: redis://redis:6379 (Docker service name on ai-stack-net bridge).
// Override via REDIS_URL environment variable.
// All connections are LAZY — created only on first access.
// ═══════════════════════════════════════════════════════════════════════════════

import { Redis } from "ioredis";

// ─── Lazy Connection State ───────────────────────────────────────────────────

let _connection: Redis | null = null;
let _publisher: Redis | null = null;
let _subscriber: Redis | null = null;
let _isShuttingDown = false;

// ─── Connection Factory ──────────────────────────────────────────────────────

function resolveRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://redis:6379";
}

function createConnection(): Redis {
  const url = resolveRedisUrl();

  const redis = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      if (_isShuttingDown) return null;
      return Math.min(times * 200, 5000);
    },
    lazyConnect: true,
  });

  redis.on("connect", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Redis] Connected to", url);
    }
  });

  redis.on("error", (error) => {
    if (!_isShuttingDown) {
      console.error("[Redis] Error:", error.message);
    }
  });

  redis.on("reconnecting", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Redis] Reconnecting...");
    }
  });

  redis.connect().catch((err) => {
    if (!_isShuttingDown) {
      console.error("[Redis] Initial connection failed:", err.message);
    }
  });

  return redis;
}

// ─── Connection Getters (Lazy) ───────────────────────────────────────────────

export function getRedisConnection(): Redis {
  if (!_connection || _connection.status === "end") {
    _connection = createConnection();
  }
  return _connection;
}

export function getRedisPublisher(): Redis {
  if (!_publisher || _publisher.status === "end") {
    _publisher = createConnection();
  }
  return _publisher;
}

export function getRedisSubscriber(): Redis {
  if (!_subscriber || _subscriber.status === "end") {
    _subscriber = createConnection();
  }
  return _subscriber;
}

// ─── Health Checks ───────────────────────────────────────────────────────────

export function isRedisConnected(): boolean {
  return _connection?.status === "ready";
}

export async function pingRedis(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

export async function closeRedisConnections(): Promise<void> {
  _isShuttingDown = true;

  const close = async (redis: Redis | null, name: string) => {
    if (redis && redis.status !== "end") {
      try {
        await redis.quit();
        if (process.env.NODE_ENV === "development") {
          console.log(`[Redis] ${name} closed`);
        }
      } catch (error) {
        console.error(`[Redis] Error closing ${name}:`, error);
      }
    }
  };

  await Promise.all([
    close(_connection, "main"),
    close(_publisher, "publisher"),
    close(_subscriber, "subscriber"),
  ]);

  _connection = null;
  _publisher = null;
  _subscriber = null;
}

// ─── Process Handlers ────────────────────────────────────────────────────────

process.on("SIGINT", async () => {
  await closeRedisConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeRedisConnections();
  process.exit(0);
});
