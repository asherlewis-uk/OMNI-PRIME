import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// NOTE: This is a server-side only client.
const sqlite = new Database('sqlite.db');
export const db = drizzle(sqlite, { schema });

/**
 * Seeds the database with initial data if it's empty.
 * This function should be called conditionally, for example, at application startup.
 * It is safe to call multiple times.
 */
export async function initializeDb() {
	// Check if a user profile already exists to prevent re-seeding.
	const existingProfile = await db.query.userProfiles.findFirst();

	if (!existingProfile) {
		await db.insert(schema.userProfiles).values({
			useCase: 'custom', // Correct: uses the camelCase schema key
			objectives: ['Create a new project'],
		});
		console.log('✅ Database seeded successfully.');
	}
}