import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
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
// FALLBACK: If index doesn't exist yet, fall back to list() method
const getCachedSnapshotList = unstable_cache(
  async (): Promise<SnapshotListResult> => {
    const index = await loadSnapshotIndex();

    // If index has snapshots, use it (optimized path)
    if (index.snapshots.length > 0) {
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
    }

    // FALLBACK: Index doesn't exist or is empty, use traditional list() method
    console.log('⚠️ Snapshot index not found or empty, falling back to list() operation');
    console.log('💡 Run "npx tsx scripts/rebuild-snapshot-index.ts" to create the index and optimize costs');
    
    const { blobs } = await list({
      prefix: 'snapshots/',
    });

    const snapshots: HistoricalSnapshot[] = [];

    for (const blob of blobs) {
      if (blob.pathname.endsWith('.json') && !blob.pathname.endsWith('index.json')) {
        try {
          const response = await fetch(blob.url);
          if (!response.ok) continue;
          
          const data = await response.json();
          
          // Validate snapshot metadata
          const validatedMetadata = safeValidate(
            HistoricalSnapshotMetadataSchema,
            {
              date: data.date,
              webpageTimestamp: data.webpageTimestamp,
              capturedAt: data.capturedAt
            },
            `Snapshot metadata for ${blob.pathname}`
          );
          
          if (validatedMetadata) {
            snapshots.push(validatedMetadata);
          } else {
            console.warn(`Skipping invalid snapshot metadata: ${blob.pathname}`);
          }
        } catch (error) {
          console.error(`Error reading snapshot ${blob.pathname}:`, error);
        }
      }
    }

    // Sort by date, most recent first
    snapshots.sort((a, b) => b.date.localeCompare(a.date));

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
