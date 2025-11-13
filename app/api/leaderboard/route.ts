import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
const requestLog = new Map<string, number[]>();

// Caching configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface PlayerData {
  rank: number;
  name: string;
  evWon: number;
  evBB100: number;
  won: number;
  hands: number;
}

let cachedData: { players: PlayerData[]; lastUpdated: string } | null = null;
let cacheTimestamp = 0;

// Input sanitization function
function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove JavaScript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 200); // Limit length
}

function sanitizeNumber(input: string, isInteger = false): number {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const num = isInteger ? parseInt(cleaned) : parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Rate limiting middleware
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = requestLog.get(ip) || [];
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }
  
  recentRequests.push(now);
  requestLog.set(ip, recentRequests);
  
  return true;
}

// Request logging
function logRequest(ip: string, status: 'success' | 'error' | 'rate-limited', details?: string) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    ip,
    status,
    endpoint: '/api/leaderboard',
    details: details || 'N/A'
  }));
}

export async function GET(request: Request) {
  // Get client IP for rate limiting
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // Rate limiting check
  if (!checkRateLimit(ip)) {
    logRequest(ip, 'rate-limited');
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
          'X-RateLimit-Remaining': '0'
        }
      }
    );
  }

  // Check cache
  const now = Date.now();
  if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
    logRequest(ip, 'success', 'served from cache');
    return NextResponse.json(cachedData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'HIT'
      }
    });
  }

  try {
    const response = await fetch('https://www.pokerstrategy.com/HSCGWP2025/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      logRequest(ip, 'error', `HTTP ${response.status} from external source`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // Validate HTML content
    if (!html || html.length < 100) {
      logRequest(ip, 'error', 'Invalid HTML response');
      throw new Error('Invalid response from external source');
    }

    const $ = cheerio.load(html);
    
    const players: PlayerData[] = [];

    // Find the table and parse rows
    $('table.tableDefault tbody tr').each((index, element) => {
      const cells = $(element).find('td');
      if (cells.length >= 6) {
        const nameRaw = $(cells[1]).text().trim();
        const evWonText = $(cells[2]).text().trim();
        const evBB100Text = $(cells[3]).text().trim();
        const wonText = $(cells[4]).text().trim();
        const handsText = $(cells[5]).text().trim();

        // Sanitize and validate inputs
        const name = sanitizeString(nameRaw);
        
        // Skip if essential fields are empty or invalid
        if (!name || name.length < 1) {
          return; // continue to next iteration
        }

        const evWon = sanitizeNumber(evWonText);
        const evBB100 = sanitizeNumber(evBB100Text);
        const won = sanitizeNumber(wonText);
        const hands = sanitizeNumber(handsText, true);

        // Additional validation
        if (hands < 0 || hands > 1000000000) {
          return; // Skip invalid hand counts
        }

        players.push({
          rank: index + 1,
          name: name,
          evWon: evWon,
          evBB100: evBB100,
          won: won,
          hands: hands
        });
      }
    });

    // Validate we got reasonable data
    if (players.length === 0) {
      logRequest(ip, 'error', 'No valid player data found');
      throw new Error('No player data found in response');
    }

    // Cache the result
    const responseData = {
      players,
      lastUpdated: new Date().toISOString()
    };
    
    cachedData = responseData;
    cacheTimestamp = Date.now();

    logRequest(ip, 'success', `${players.length} players fetched`);

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logRequest(ip, 'error', errorMessage);
    
    // Return cached data if available, even if stale
    if (cachedData) {
      console.warn('Returning stale cached data due to error:', errorMessage);
      return NextResponse.json({
        ...cachedData,
        warning: 'Using cached data due to temporary fetch error'
      }, {
        headers: {
          'X-Cache': 'STALE'
        }
      });
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch leaderboard data',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
