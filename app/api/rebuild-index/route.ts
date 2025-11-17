import { NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';
import { HistoricalSnapshotSchema, safeValidate } from '@/lib/schemas';

/**
 * REBUILD ENDPOINT: Rebuilds the snapshot index from actual blob storage
 * Visit: /api/rebuild-index
 * 
 * This endpoint scans all snapshot files in blob storage and rebuilds
 * the index.json file to ensure it's in sync with actual data.
 */
export async function GET() {
  try {
    console.log('🔄 Starting snapshot index rebuild...');
    
    // 1. List all blobs in snapshots/ prefix
    const allBlobs: any[] = [];
    let cursor: string | undefined = undefined;
    
    console.log('📋 Fetching existing snapshots from blob storage...');
    do {
      const { blobs, cursor: nextCursor }: { blobs: any[], cursor?: string } = await list({
        prefix: 'snapshots/',
        limit: 1000,
        cursor,
      });
      allBlobs.push(...blobs);
      cursor = nextCursor;
    } while (cursor);

    console.log(`📦 Found ${allBlobs.length} blob(s)`);

    // 2. Filter for JSON files only (exclude index.json)
    const snapshotBlobs = allBlobs.filter(
      blob => blob.pathname.endsWith('.json') && !blob.pathname.endsWith('index.json')
    );

    console.log(`📸 Processing ${snapshotBlobs.length} snapshot(s)...`);

    // 3. Fetch metadata from each snapshot
    const snapshots: any[] = [];
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
      } catch (error: any) {
        console.error(`❌ Error processing ${blob.pathname}:`, error);
        errorCount++;
      }
    }

    console.log(`📊 Summary: ✅ ${successCount} successful, ❌ ${errorCount} errors`);

    if (snapshots.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No valid snapshots found to index',
        successCount,
        errorCount
      }, { status: 400 });
    }

    // 4. Sort by date, most recent first
    snapshots.sort((a, b) => b.date.localeCompare(a.date));

    // 5. Create index object
    const index = {
      snapshots,
      lastUpdated: new Date().toISOString(),
      count: snapshots.length
    };

    // 6. Save index to blob storage
    console.log('💾 Saving index to blob storage...');
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
    
    const dateRange = snapshots.length > 0 
      ? `${snapshots[snapshots.length - 1].date} to ${snapshots[0].date}`
      : 'N/A';
    console.log(`📅 Date range: ${dateRange}`);
    console.log('✨ Done! The snapshot index has been rebuilt.');

    return NextResponse.json({
      success: true,
      message: 'Snapshot index rebuilt successfully',
      totalSnapshots: snapshots.length,
      dateRange,
      dates: snapshots.map(s => s.date),
      successCount,
      errorCount,
      index
    }, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      }
    });
  } catch (error: any) {
    console.error('❌ Fatal error rebuilding snapshot index:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error',
      stack: error?.stack
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      }
    });
  }
}
