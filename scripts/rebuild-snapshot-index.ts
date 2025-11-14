/**
 * Rebuild snapshot index from existing snapshots
 * Run this once to create the initial index.json file from existing snapshots
 * 
 * Usage: npx tsx scripts/rebuild-snapshot-index.ts
 */

import { list, put } from '@vercel/blob';
import { HistoricalSnapshotSchema, safeValidate } from '@/lib/schemas';

interface SnapshotMetadata {
  date: string;
  webpageTimestamp: string;
  capturedAt: string;
  playerCount: number;
}

async function rebuildSnapshotIndex() {
  console.log('🔄 Rebuilding snapshot index...\n');

  try {
    // List all existing snapshots
    console.log('📋 Fetching existing snapshots from blob storage...');
    const allBlobs: Array<{ pathname: string; url: string }> = [];
    let cursor: string | undefined;
    
    do {
      const { blobs, cursor: nextCursor } = await list({
        prefix: 'snapshots/',
        limit: 1000,
        cursor,
      });
      
      allBlobs.push(...blobs);
      cursor = nextCursor;
    } while (cursor);

    console.log(`📦 Found ${allBlobs.length} blob(s)\n`);

    // Filter for JSON files only (exclude index.json)
    const snapshotBlobs = allBlobs.filter(
      blob => blob.pathname.endsWith('.json') && !blob.pathname.endsWith('index.json')
    );

    console.log(`📸 Processing ${snapshotBlobs.length} snapshot(s)...\n`);

    // Fetch metadata from each snapshot
    const snapshots: SnapshotMetadata[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const blob of snapshotBlobs) {
      try {
        const response = await fetch(blob.url);
        if (!response.ok) {
          console.warn(`⚠️  Failed to fetch ${blob.pathname}: ${response.statusText}`);
          errorCount++;
          continue;
        }

        const data = await response.json();
        
        // Validate snapshot data
        const validatedSnapshot = safeValidate(
          HistoricalSnapshotSchema,
          data,
          `Snapshot validation for ${blob.pathname}`
        );

        if (!validatedSnapshot) {
          console.warn(`⚠️  Invalid snapshot data for ${blob.pathname}, skipping`);
          errorCount++;
          continue;
        }

        snapshots.push({
          date: validatedSnapshot.date,
          webpageTimestamp: validatedSnapshot.webpageTimestamp,
          capturedAt: validatedSnapshot.capturedAt,
          playerCount: validatedSnapshot.players.length
        });

        successCount++;
        console.log(`✅ Processed ${validatedSnapshot.date} (${validatedSnapshot.players.length} players)`);
      } catch (error) {
        console.error(`❌ Error processing ${blob.pathname}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully processed: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (snapshots.length === 0) {
      console.log('\n⚠️  No valid snapshots found to index');
      return;
    }

    // Sort by date, most recent first
    snapshots.sort((a, b) => b.date.localeCompare(a.date));

    // Create index object
    const index = {
      snapshots,
      lastUpdated: new Date().toISOString(),
      count: snapshots.length
    };

    // Save index to blob storage
    console.log('\n💾 Saving index to blob storage...');
    const indexPath = 'snapshots/index.json';
    await put(indexPath, JSON.stringify(index, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 0,
      allowOverwrite: true,
    });

    console.log(`✅ Index saved successfully: ${indexPath}`);
    console.log(`📈 Total snapshots indexed: ${snapshots.length}`);
    console.log(`📅 Date range: ${snapshots[snapshots.length - 1].date} to ${snapshots[0].date}`);
    console.log('\n✨ Done! The snapshot index has been rebuilt.');
    console.log('🎯 Future API requests will now use this index instead of list() operations.');
  } catch (error) {
    console.error('\n❌ Fatal error rebuilding snapshot index:', error);
    process.exit(1);
  }
}

// Run the script
rebuildSnapshotIndex();
