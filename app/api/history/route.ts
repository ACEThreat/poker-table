import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { unstable_cache } from 'next/cache';
import { HistoricalSnapshotMetadataSchema, SnapshotListResponseSchema, safeValidate } from '@/lib/schemas';

interface HistoricalSnapshot {
  date: string;
  webpageTimestamp: string;
  capturedAt: string;
}

interface SnapshotListResult {
  snapshots: HistoricalSnapshot[];
  count: number;
}

// Cached function to fetch snapshot list
// Since snapshots are only added once per day, we can cache this aggressively
// Cache duration: 1 hour (3600 seconds)
const getCachedSnapshotList = unstable_cache(
  async (): Promise<SnapshotListResult> => {
    const { blobs } = await list({
      prefix: 'snapshots/',
    });

    const snapshots: HistoricalSnapshot[] = [];

    for (const blob of blobs) {
      if (blob.pathname.endsWith('.json')) {
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
    revalidate: 3600, // Cache for 1 hour (snapshots only change once per day)
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
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
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
