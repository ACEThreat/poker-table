import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SNAPSHOTS_DIR = path.join(process.cwd(), '.cache', 'leaderboard', 'snapshots');

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

    const snapshotPath = path.join(SNAPSHOTS_DIR, `${date}.json`);
    
    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot: HistoricalSnapshot = JSON.parse(content);
      
      return NextResponse.json({
        ...snapshot,
        isHistorical: true
      }, {
        headers: {
          'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        }
      });
    } catch (error) {
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
