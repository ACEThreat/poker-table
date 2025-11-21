/**
 * Main data fetching and caching logic for the leaderboard API
 * Coordinates web scraping, parsing, and data enrichment
 */

import * as cheerio from 'cheerio';
import { unstable_cache } from 'next/cache';
import { LEADERBOARD_URL, DATA_FETCH_TIMEOUT, CACHE_DURATION } from './constants';
import { CachedData, PlayerData } from './types';
import { parseWebpageTimestamp, sanitizeString, sanitizeNumber } from './data-parsing';
import { mergeCountryCodes } from './country-management';
import { loadPreviousDaySnapshot, calculateChanges, updateDailySnapshot } from './snapshot-management';
import { PlayerSchema, CachedDataSchema, validateOrThrow } from '@/lib/schemas';

/**
 * Fetch and process leaderboard data from the source webpage
 * This function is cached using Next.js unstable_cache for serverless compatibility
 * @returns Cached leaderboard data with players, timestamps, and change indicators
 */
export const getCachedLeaderboardData = unstable_cache(
  async (): Promise<CachedData> => {
    const response = await fetch(LEADERBOARD_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(DATA_FETCH_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // Validate HTML content
    if (!html || html.length < 100) {
      throw new Error('Invalid response from external source');
    }

    // Extract the webpage timestamp
    const webpageTimestamp = parseWebpageTimestamp(html);

    const $ = cheerio.load(html);
    
    const players: PlayerData[] = [];

    // Find the table and parse rows
    $('table.tableDefault tbody tr').each((index, element) => {
      const cells = $(element).find('td');
      if (cells.length >= 6) {
        const nameRaw = $(cells[1]).text().trim();

        // Extract values, removing any superscript details (daily changes)
        const evWonText = $(cells[2]).clone().find('sup').remove().end().text().trim();
        const evBB100Text = $(cells[3]).text().trim();
        const wonText = $(cells[4]).text().trim();
        const handsText = $(cells[5]).clone().find('sup').remove().end().text().trim();

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

        const playerData = {
          rank: index + 1,
          name: name,
          evWon: evWon,
          evBB100: evBB100,
          won: won,
          hands: hands
        };

        // Validate player data before adding
        const validatedPlayer = PlayerSchema.safeParse(playerData);
        if (validatedPlayer.success) {
          players.push(validatedPlayer.data);
        } else {
          console.warn(`Skipping invalid player data at rank ${index + 1}:`, validatedPlayer.error.issues);
        }
      }
    });

    // Validate we got reasonable data
    if (players.length === 0) {
      throw new Error('No player data found in response');
    }

    // Merge country codes into player data (and auto-add new players to config)
    const playersWithCountries = await mergeCountryCodes(players);
    
    // Load previous day's snapshot for comparison
    const previousSnapshot = await loadPreviousDaySnapshot();
    
    // Calculate changes from previous day
    const playersWithChanges = calculateChanges(playersWithCountries, previousSnapshot);

    // Update daily snapshot if needed (non-blocking)
    updateDailySnapshot(players, webpageTimestamp || new Date().toISOString()).catch(err => {
      console.error('Error updating daily snapshot:', err);
    });

    const cachedData: CachedData = {
      players: playersWithChanges,
      lastUpdated: new Date().toISOString(),
      webpageTimestamp: webpageTimestamp || new Date().toISOString()
    };

    // Validate the complete cached data before returning
    return validateOrThrow(
      CachedDataSchema,
      cachedData,
      'Leaderboard cached data validation'
    );
  },
  ['leaderboard-data'], // Cache key
  {
    revalidate: CACHE_DURATION, // Cache for 5 minutes
    tags: ['leaderboard-data'] // Tags for potential on-demand revalidation
  }
);
