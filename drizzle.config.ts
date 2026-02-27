// ═══════════════════════════════════════════════════════════════════════════════
// DRIZZLE CONFIGURATION - Database Schema Management
// ═══════════════════════════════════════════════════════════════════════════════

import { defineConfig } from "drizzle-kit";

// Database path - matches the path used in src/lib/db/client.ts
const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/omni.db";

export default defineConfig({
  // Database dialect
  dialect: "sqlite",

  // Schema file location
  schema: "./src/lib/db/schema.ts",

  // Migrations output directory
  out: "./src/lib/db/migrations",

  // Database credentials
  dbCredentials: {
    url: DATABASE_URL,
  },

  // Enable strict mode for type safety
  strict: true,

  // Enable verbose logging in development
  verbose: process.env.NODE_ENV === "development",
});
