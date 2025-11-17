import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

/**
 * DEBUG ENDPOINT: Lists all snapshots in blob storage and compares with index
 * Visit: /api/debug-snapshots
 */
export async function GET() {
  try {
    // 1. List all blobs in snapshots/ prefix
    const allBlobs: any[] = [];
    let cursor: string | undefined = undefined;
    
    console.log('🔍 Fetching all blobs from storage...');
    while (true) {
      const listResult = await list({
        prefix: 'snapshots/',
        limit: 1000,
        cursor,
      });
      allBlobs.push(...listResult.blobs);
      if (!listResult.cursor) break;
      cursor = listResult.cursor;
    }

    console.log(`📦 Found ${allBlobs.length} total blobs`);

    // 2. Separate index from snapshot files
    const indexBlob = allBlobs.find(b => b.pathname.endsWith('index.json'));
    const snapshotBlobs = allBlobs.filter(
      b => b.pathname.endsWith('.json') && !b.pathname.endsWith('index.json')
    );

    console.log(`📸 Found ${snapshotBlobs.length} snapshot files`);

    // 3. Extract dates from snapshot files
    const actualDates = snapshotBlobs
      .map(blob => {
        const match = blob.pathname.match(/snapshots\/(\d{4}-\d{2}-\d{2})\.json$/);
        return match ? match[1] : null;
      })
      .filter(Boolean)
      .sort()
      .reverse();

    console.log(`📅 Snapshot dates in storage: ${actualDates.join(', ')}`);

    // 4. Load and check index file
    let indexData = null;
    if (indexBlob) {
      console.log('📋 Index file exists, loading...');
      const indexResponse = await fetch(indexBlob.url);
      indexData = await indexResponse.json();
      console.log(`📋 Index contains ${indexData.snapshots?.length || 0} entries`);
    } else {
      console.log('⚠️  No index file found!');
    }

    // 5. Compare index with actual files
    const indexDates = indexData?.snapshots?.map((s: any) => s.date) || [];
    const missingInIndex = actualDates.filter((d: string) => !indexDates.includes(d));
    const missingInStorage = indexDates.filter((d: string) => !actualDates.includes(d));

    const report = {
      timestamp: new Date().toISOString(),
      storage: {
        totalBlobs: allBlobs.length,
        snapshotFiles: snapshotBlobs.length,
        dates: actualDates,
        files: snapshotBlobs.map(b => ({
          path: b.pathname,
          url: b.url,
          uploadedAt: b.uploadedAt,
          size: b.size
        }))
      },
      index: {
        exists: !!indexBlob,
        entryCount: indexData?.snapshots?.length || 0,
        dates: indexDates,
        lastUpdated: indexData?.lastUpdated,
        fullData: indexData
      },
      analysis: {
        mismatch: actualDates.length !== indexDates.length,
        missingInIndex,
        missingInStorage,
        recommendation: missingInIndex.length > 0 
          ? '⚠️  Index is outdated! Run rebuild script or visit /api/rebuild-index'
          : missingInStorage.length > 0
          ? '⚠️  Index has phantom entries! Snapshots deleted but index not updated'
          : actualDates.length === indexDates.length
          ? '✅ Index is in sync with storage'
          : '❓ Unknown issue'
      }
    };

    console.log('📊 Analysis complete:', report.analysis);

    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      }
    });
  } catch (error: any) {
    console.error('❌ Error in debug endpoint:', error);
    return NextResponse.json({
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
