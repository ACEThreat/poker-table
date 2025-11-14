/**
 * Leaderboard API route handler
 * Provides current leaderboard data with caching and rate limiting
 */

import { NextResponse } from 'next/server';
import { MAX_REQUESTS_PER_WINDOW } from '@/lib/api/constants';
import { checkRateLimit, logRequest } from '@/lib/api/rate-limiting';
import { getCachedLeaderboardData } from '@/lib/api/data-fetcher';
import { fetchWebpageTimestamp } from '@/lib/api/data-parsing';
import { loadPreviousDaySnapshot } from '@/lib/api/snapshot-management';
import { CachedData } from '@/lib/api/types';
import { LeaderboardResponseSchema, safeValidate } from '@/lib/schemas';

/**
 * GET handler for leaderboard data
 * Returns current leaderboard with player rankings, stats, and change indicators
 */
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

  try {
    // Try to get cached data first (Next.js will handle cache invalidation)
    let cachedData: CachedData;
    let cacheStatus = 'MISS';
    let cacheReason = 'initial-fetch';

    try {
      // Attempt to get cached data
      cachedData = await getCachedLeaderboardData();
      
      // Quick timestamp check to see if webpage has been updated
      const currentWebpageTimestamp = await fetchWebpageTimestamp();
      
      if (currentWebpageTimestamp && currentWebpageTimestamp !== cachedData.webpageTimestamp) {
        // Webpage has been updated, bypass cache and fetch fresh data
        // We'll let the cache naturally expire, but fetch fresh data now
        cacheStatus = 'BYPASS';
        cacheReason = 'webpage-updated';
        // Force refetch by throwing an error to trigger the catch block
        throw new Error('Webpage timestamp changed, fetching fresh data');
      } else {
        // Cache is valid
        cacheStatus = currentWebpageTimestamp ? 'HIT' : 'HIT-NO-TIMESTAMP-CHECK';
        cacheReason = currentWebpageTimestamp ? 'webpage-unchanged' : 'timestamp-check-failed';
      }
    } catch (cacheError) {
      // If cache miss or timestamp changed, fetch fresh data
      cacheStatus = 'MISS';
      cacheReason = cacheError instanceof Error && cacheError.message.includes('timestamp changed')
        ? 'webpage-updated'
        : 'cache-miss';
      cachedData = await getCachedLeaderboardData();
    }

    // Load previous day's snapshot info for response
    const previousSnapshot = await loadPreviousDaySnapshot();

    logRequest(ip, 'success', `served from cache (${cacheReason})`);

    const responseData = {
      players: cachedData.players,
      lastUpdated: cachedData.lastUpdated,
      webpageTimestamp: cachedData.webpageTimestamp,
      hasPreviousDayData: previousSnapshot !== null,
      previousDayDate: previousSnapshot?.date || null,
      isHistorical: false
    };

    // Validate response data before sending to client
    const validatedResponse = safeValidate(
      LeaderboardResponseSchema,
      responseData,
      'Leaderboard API response'
    );

    if (!validatedResponse) {
      throw new Error('Failed to validate leaderboard response data');
    }

    return NextResponse.json(validatedResponse, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': cacheStatus,
        'X-Cache-Reason': cacheReason
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logRequest(ip, 'error', errorMessage);
    
    // For errors, Next.js cache will handle stale-while-revalidate
    // But we'll try to return a user-friendly error
    return NextResponse.json(
      {
        error: 'Failed to fetch leaderboard data',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
