#!/usr/bin/env npx tsx
/**
 * Migration Script: chatId → identifier + platform
 *
 * One-time MongoDB migration that splits the `chatId` field (e.g., "254722833440@c.us")
 * into separate `identifier` (e.g., "254722833440") and `platform` (e.g., "c.us") fields.
 *
 * Affects collections:
 * - users: chatId → identifier + platform, drop phoneNumber
 * - conversationstates: chatId → identifier + platform
 * - conversationsummaries: chatId → identifier + platform
 * - conversationassignments: (if chatId field exists)
 *
 * Usage:
 *   npx tsx scripts/migrate-chatid-to-identifier.ts --dry-run    # Preview changes
 *   npx tsx scripts/migrate-chatid-to-identifier.ts              # Execute migration
 *   npx tsx scripts/migrate-chatid-to-identifier.ts --rollback   # Revert migration
 *
 * Environment:
 *   MONGODB_URI=mongodb://localhost:27017/whatsapp-service (or set via --uri flag)
 */

import mongoose from 'mongoose';

// =============================================================================
// Configuration
// =============================================================================

const VALID_PLATFORMS = new Set(['c.us', 'g.us', 'lid']);
const DEFAULT_PLATFORM = 'c.us';

interface MigrationArgs {
  dryRun: boolean;
  rollback: boolean;
  mongoUri: string;
}

function parseArgs(): MigrationArgs {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    rollback: args.includes('--rollback'),
    mongoUri: getArgValue(args, '--uri') || process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-service',
  };
}

function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

// =============================================================================
// Chat ID Parsing
// =============================================================================

interface ParsedChatId {
  identifier: string;
  platform: string;
}

function parseChatId(chatId: string): ParsedChatId {
  if (!chatId || typeof chatId !== 'string') {
    throw new Error(`Invalid chatId: "${chatId}"`);
  }

  const atIndex = chatId.lastIndexOf('@');
  if (atIndex === -1) {
    // No @ suffix - treat as identifier with default platform
    return { identifier: chatId, platform: DEFAULT_PLATFORM };
  }

  const identifier = chatId.slice(0, atIndex);
  const suffix = chatId.slice(atIndex + 1);

  if (!VALID_PLATFORMS.has(suffix)) {
    console.warn(`  Warning: Unknown platform "${suffix}" in chatId "${chatId}", using as-is`);
    return { identifier, platform: suffix };
  }

  return { identifier, platform: suffix };
}

// =============================================================================
// Migration Logic
// =============================================================================

interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

async function migrateCollection(
  db: mongoose.Connection,
  collectionName: string,
  dryRun: boolean,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    collection: collectionName,
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  const collection = db.collection(collectionName);

  // Check if collection exists
  const collections = await db.db!.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    console.log(`  Collection "${collectionName}" does not exist, skipping`);
    return stats;
  }

  // Find documents that have chatId but not identifier (not yet migrated)
  const hasChatId = await collection.countDocuments({ chatId: { $exists: true } });
  const hasIdentifier = await collection.countDocuments({ identifier: { $exists: true } });

  console.log(`  ${collectionName}: ${hasChatId} docs with chatId, ${hasIdentifier} docs with identifier`);

  if (hasChatId === 0) {
    console.log(`  No documents with chatId field found, skipping`);
    stats.skipped = hasIdentifier;
    return stats;
  }

  // Get all documents with chatId
  const cursor = collection.find({ chatId: { $exists: true } });
  const docs = await cursor.toArray();
  stats.total = docs.length;

  for (const doc of docs) {
    try {
      const chatId = doc.chatId as string;
      const { identifier, platform } = parseChatId(chatId);

      if (dryRun) {
        console.log(`  [DRY RUN] Would migrate: chatId="${chatId}" → identifier="${identifier}", platform="${platform}"`);
        stats.migrated++;
        continue;
      }

      // Update: set identifier + platform, unset chatId + phoneNumber
      const updateOp: Record<string, unknown> = {
        $set: { identifier, platform },
        $unset: { chatId: '' },
      };

      // Also remove phoneNumber if it exists (users collection)
      if ('phoneNumber' in doc) {
        (updateOp.$unset as Record<string, string>).phoneNumber = '';
      }

      await collection.updateOne({ _id: doc._id }, updateOp);
      stats.migrated++;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  Error migrating doc ${doc._id}: ${msg}`);
      stats.errors++;
    }
  }

  return stats;
}

async function updateIndexes(
  db: mongoose.Connection,
  collectionName: string,
  dryRun: boolean,
): Promise<void> {
  const collection = db.collection(collectionName);

  // Check if collection exists
  const collections = await db.db!.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) return;

  const indexes = await collection.indexes();

  // Drop old chatId indexes
  for (const idx of indexes) {
    if (idx.key && 'chatId' in idx.key) {
      if (dryRun) {
        console.log(`  [DRY RUN] Would drop index "${idx.name}" on ${collectionName}`);
      } else {
        try {
          await collection.dropIndex(idx.name!);
          console.log(`  Dropped index "${idx.name}" on ${collectionName}`);
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`  Warning: Could not drop index "${idx.name}": ${msg}`);
        }
      }
    }
  }

  // Create new identifier indexes based on collection
  const newIndexes: Record<string, Array<{ spec: Record<string, number>; options?: mongoose.mongo.CreateIndexesOptions }>> = {
    users: [
      { spec: { identifier: 1 }, options: { unique: true } },
    ],
    conversationstates: [
      { spec: { identifier: 1 } },
      { spec: { identifier: 1, platform: 1, sessionId: 1 }, options: { unique: true } },
    ],
    conversationsummaries: [
      { spec: { identifier: 1 } },
      { spec: { identifier: 1, date: -1 } },
      { spec: { identifier: 1, tag: 1, date: -1 } },
    ],
    conversationassignments: [
      { spec: { identifier: 1 }, options: { unique: true } },
    ],
  };

  const collectionIndexes = newIndexes[collectionName] || [];
  for (const { spec, options } of collectionIndexes) {
    if (dryRun) {
      console.log(`  [DRY RUN] Would create index ${JSON.stringify(spec)} on ${collectionName}`);
    } else {
      try {
        await collection.createIndex(spec, options || {});
        console.log(`  Created index ${JSON.stringify(spec)} on ${collectionName}`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        // Index might already exist
        console.warn(`  Warning: Could not create index: ${msg}`);
      }
    }
  }
}

// =============================================================================
// Rollback Logic
// =============================================================================

async function rollbackCollection(
  db: mongoose.Connection,
  collectionName: string,
  dryRun: boolean,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    collection: collectionName,
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  const collection = db.collection(collectionName);

  const collections = await db.db!.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    console.log(`  Collection "${collectionName}" does not exist, skipping`);
    return stats;
  }

  // Find documents with identifier (already migrated)
  const cursor = collection.find({ identifier: { $exists: true } });
  const docs = await cursor.toArray();
  stats.total = docs.length;

  if (docs.length === 0) {
    console.log(`  No migrated documents found in ${collectionName}`);
    return stats;
  }

  for (const doc of docs) {
    try {
      const identifier = doc.identifier as string;
      const platform = (doc.platform as string) || DEFAULT_PLATFORM;
      const chatId = `${identifier}@${platform}`;

      if (dryRun) {
        console.log(`  [DRY RUN] Would rollback: identifier="${identifier}", platform="${platform}" → chatId="${chatId}"`);
        stats.migrated++;
        continue;
      }

      await collection.updateOne({ _id: doc._id }, {
        $set: { chatId, phoneNumber: identifier },
        $unset: { identifier: '', platform: '' },
      });
      stats.migrated++;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  Error rolling back doc ${doc._id}: ${msg}`);
      stats.errors++;
    }
  }

  return stats;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const { dryRun, rollback, mongoUri } = parseArgs();
  const mode = rollback ? 'ROLLBACK' : 'MIGRATE';

  console.log('='.repeat(60));
  console.log(`chatId → identifier + platform Migration`);
  console.log(`Mode: ${mode}${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`MongoDB: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  console.log('='.repeat(60));

  // Connect to MongoDB
  const conn = await mongoose.createConnection(mongoUri).asPromise();
  console.log('Connected to MongoDB\n');

  const targetCollections = [
    'users',
    'conversationstates',
    'conversationsummaries',
    'conversationassignments',
  ];

  const allStats: MigrationStats[] = [];

  for (const collectionName of targetCollections) {
    console.log(`\nProcessing: ${collectionName}`);
    console.log('-'.repeat(40));

    const stats = rollback
      ? await rollbackCollection(conn, collectionName, dryRun)
      : await migrateCollection(conn, collectionName, dryRun);

    if (!rollback) {
      console.log(`\n  Updating indexes for ${collectionName}...`);
      await updateIndexes(conn, collectionName, dryRun);
    }

    allStats.push(stats);
    console.log(`  Result: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  for (const stats of allStats) {
    console.log(`  ${stats.collection}: ${stats.migrated}/${stats.total} migrated, ${stats.errors} errors`);
  }

  const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0);
  if (totalErrors > 0) {
    console.log(`\nWARNING: ${totalErrors} errors occurred during migration`);
  }

  if (dryRun) {
    console.log('\nThis was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  }

  await conn.close();
  console.log('\nDone.');
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error('Migration failed:', msg);
  process.exit(1);
});
