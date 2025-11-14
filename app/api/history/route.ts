import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { HistoricalSnapshotMetadataSchema, SnapshotListResponseSchema, safeValidate } from '@/lib/schemas';
import { loadSnapshotIndex } from '@/lib/api/snapshot-management';

interface HistoricalSnapshot {
  date: string;
  webpageTimestamp: string;
  capturedAt: string;
}

interface SnapshotListResult {
  snapshots: HistoricalSnapshot[];
  count: number;
}

// OPTIMIZATION: Use snapshot index file instead of expensive list() operation
// This eliminates 1 advanced operation per request (5x cost reduction)
// The index is maintained automatically when snapshots are saved
const getCachedSnapshotList = unstable_cache(
  async (): Promise<SnapshotListResult> => {
    const index = await loadSnapshotIndex();

    const snapshots: HistoricalSnapshot[] = [];

    for (const snapshot of index.snapshots) {
      // Validate snapshot metadata
      const validatedMetadata = safeValidate(
        HistoricalSnapshotMetadataSchema,
        {
          date: snapshot.date,
          webpageTimestamp: snapshot.webpageTimestamp,
          capturedAt: snapshot.capturedAt
        },
        `Snapshot metadata for ${snapshot.date}`
      );
      
      if (validatedMetadata) {
        snapshots.push(validatedMetadata);
      } else {
        console.warn(`Skipping invalid snapshot metadata: ${snapshot.date}`);
      }
    }

    return {
      snapshots,
      count: snapshots.length
    };
  },
  ['snapshot-list'], // Cache key
  {
    revalidate: 3600, // Cache for 1 hour
    tags: ['snapshot-list'] // Tags for potential on-demand revalidation
  }
);

export async function GET() {
  try {
    // Use cached snapshot list
    const result = await getCachedSnapshotList();
    
    // Validate the response before sending
    const validatedResponse = safeValidate(
      SnapshotListResponseSchema,
      result,
      'Snapshot list API response'
    );
    
    if (!validatedResponse) {
      throw new Error('Failed to validate snapshot list response');
    }
    
    return NextResponse.json(validatedResponse, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'HIT'
      }
    });
  } catch (error) {
    console.error('Error fetching snapshots from Blob:', error);
    return NextResponse.json({
      snapshots: [],
      count: 0
    }, {
      status: 500
    });
  }
}
