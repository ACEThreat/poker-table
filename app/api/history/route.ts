import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

interface HistoricalSnapshot {
  date: string;
  webpageTimestamp: string;
  capturedAt: string;
}

export async function GET() {
  try {
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
          
          snapshots.push({
            date: data.date,
            webpageTimestamp: data.webpageTimestamp,
            capturedAt: data.capturedAt
          });
        } catch (error) {
          console.error(`Error reading snapshot ${blob.pathname}:`, error);
        }
      }
    }

    // Sort by date, most recent first
    snapshots.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      snapshots,
      count: snapshots.length
    });
  } catch (error) {
    console.error('Error fetching snapshots from Blob:', error);
    return NextResponse.json({
      snapshots: [],
      count: 0
    });
  }
}
