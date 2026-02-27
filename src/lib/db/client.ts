// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CLIENT — Lazy-Initialized SQLite Connection via Drizzle ORM
// Server-side only. Never import this file from client components.
// ═══════════════════════════════════════════════════════════════════════════════

import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import type { GenesisData } from "@/types/genesis";
import type { DbUserProfile } from "./schema";

// ─── Lazy Singleton ──────────────────────────────────────────────────────────

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _sqlite: InstanceType<typeof Database> | null = null;

function resolveDatabasePath(): string {
  const raw = process.env.DATABASE_URL ?? "file:./data/omni.db";
  return raw.replace(/^file:/, "");
}

/**
 * Get the Drizzle database instance (lazy-initialized).
 * Safe to call multiple times — returns the same singleton.
 */
export function getDB(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    const dbPath = resolveDatabasePath();
    _sqlite = new Database(dbPath);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
    _db = drizzle(_sqlite, { schema });
  }
  return _db;
}

/**
 * Direct reference for backward compatibility.
 * Prefer `getDB()` for explicit lazy init.
 */
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDB(), prop, receiver);
  },
});

// ─── Database Lifecycle ──────────────────────────────────────────────────────

/**
 * Close the database connection gracefully.
 * Call this on process shutdown.
 */
export function closeDB(): void {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

// ─── Seed / Initialize ───────────────────────────────────────────────────────

/**
 * Seeds the database with a default user profile if none exists.
 * Safe to call multiple times (idempotent).
 */
export async function initializeDb(): Promise<void> {
  const database = getDB();
  const existingProfile = await database.query.userProfiles.findFirst();

  if (!existingProfile) {
    await database.insert(schema.userProfiles).values({
      useCase: "custom",
      objectives: ["Get started with OMNI-PRIME"],
    });
    console.log("[DB] Default user profile seeded.");
  }
}

// ─── Genesis Data Reconstruction ─────────────────────────────────────────────

/**
 * Reconstruct a `GenesisData` composite from the flattened user_profiles row.
 * The DB stores genesis fields as individual columns; this function reassembles
 * them into the composite `GenesisData` interface used by the ContextInjector.
 *
 * @param profileId - Optional profile ID. If omitted, uses the first profile.
 * @returns The reassembled GenesisData, or null if no profile exists.
 */
export async function reconstructGenesisData(
  profileId?: string,
): Promise<GenesisData | null> {
  const database = getDB();

  let profile: DbUserProfile | undefined;

  if (profileId) {
    profile = await database.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.id, profileId),
    });
  } else {
    profile = await database.query.userProfiles.findFirst();
  }

  if (!profile) {
    return null;
  }

  return {
    useCase: profile.useCase,
    objectives: profile.objectives,
    skillLevel: profile.skillLevel,
    workStyle: profile.workStyle,
    contentTone: profile.contentTone,
    toolPreferences: profile.toolPreferences,
    rawAnswers: profile.rawAnswers,
  };
}
