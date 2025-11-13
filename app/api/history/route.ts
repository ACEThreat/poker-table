import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SNAPSHOTS_DIR = path.join(process.cwd(), '.cache', 'leaderboard', 'snapshots');

interface HistoricalSnapshot {
  date: string;
  webpageTimestamp: string;
  capturedAt: string;
}

export async function GET() {
  try {
    const files = await fs.readdir(SNAPSHOTS_DIR);
    const snapshots: HistoricalSnapshot[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(SNAPSHOTS_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          
          snapshots.push({
            date: data.date,
            webpageTimestamp: data.webpageTimestamp,
            capturedAt: data.capturedAt
          });
        } catch (error) {
          console.error(`Error reading snapshot ${file}:`, error);
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
    // Directory doesn't exist or is empty
    return NextResponse.json({
      snapshots: [],
      count: 0
    });
  }
}
