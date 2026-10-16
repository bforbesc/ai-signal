import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const gmailConnections = sqliteTable('gmail_connections', { userId: text('user_id').primaryKey(), version: text('version').notNull(), encrypted: text('encrypted').notNull(), updatedAt: integer('updated_at').notNull() });
export const gmailOauthStates = sqliteTable('gmail_oauth_states', { stateHash: text('state_hash').primaryKey(), userId: text('user_id').notNull(), expiresAt: integer('expires_at').notNull() });
