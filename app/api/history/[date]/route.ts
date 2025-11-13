import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

interface PlayerData {
  rank: number;
  name: string;
  evWon: number;
  evBB100: number;
  won: number;
  hands: number;
}

interface HistoricalSnapshot {
  date: string;
  webpageTimestamp: string;
  players: PlayerData[];
  capturedAt: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    try {
      // Find the blob for this specific date
      const { blobs } = await list({
        prefix: `snapshots/${date}.json`,
        limit: 1,
      });

      if (blobs.length === 0) {
        return NextResponse.json(
          { error: 'Snapshot not found for this date' },
          { status: 404 }
        );
      }

      const response = await fetch(blobs[0].url);
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Snapshot not found for this date' },
          { status: 404 }
        );
      }

      const snapshot: HistoricalSnapshot = await response.json();
      
      return NextResponse.json({
        ...snapshot,
        isHistorical: true
      }, {
        headers: {
          'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        }
      });
    } catch (error) {
      console.error(`Error fetching snapshot for ${date}:`, error);
      return NextResponse.json(
        { error: 'Snapshot not found for this date' },
        { status: 404 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve snapshot' },
      { status: 500 }
    );
  }
}
