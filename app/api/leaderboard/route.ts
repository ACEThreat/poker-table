import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET() {
  try {
    const response = await fetch('https://www.pokerstrategy.com/HSCGWP2025/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const players: Array<{
      rank: number;
      name: string;
      evWon: number;
      evBB100: number;
      won: number;
      hands: number;
    }> = [];

    // Find the table and parse rows
    $('table.tableDefault tbody tr').each((index, element) => {
      const cells = $(element).find('td');
      if (cells.length >= 6) {
        const rankText = $(cells[0]).text().trim();
        const name = $(cells[1]).text().trim();
        const evWonText = $(cells[2]).text().trim().replace(/[$,]/g, '');
        const evBB100Text = $(cells[3]).text().trim();
        const wonText = $(cells[4]).text().trim().replace(/[$,]/g, '');
        const handsText = $(cells[5]).text().trim().replace(/,/g, '');

        // Skip if any essential field is empty
        if (name && evWonText && handsText) {
          players.push({
            rank: index + 1,
            name: name,
            evWon: parseFloat(evWonText) || 0,
            evBB100: parseFloat(evBB100Text) || 0,
            won: parseFloat(wonText) || 0,
            hands: parseInt(handsText) || 0
          });
        }
      }
    });

    return NextResponse.json({
      players,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }
}
