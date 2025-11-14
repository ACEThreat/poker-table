/**
 * Shared type definitions for the leaderboard API
 */

/**
 * Player data structure from the leaderboard
 */
export interface PlayerData {
  rank: number;
  name: string;
  evWon: number;
  evBB100: number;
  won: number;
  hands: number;
  countryCode?: string | null; // ISO 3166-1 alpha-2 country code, null for unknown
  // Comparison fields (differences from previous day)
  rankChange?: number;
  evWonChange?: number;
  evBB100Change?: number;
  wonChange?: number;
  handsChange?: number;
}

/**
 * Cached leaderboard data structure
 */
export interface CachedData {
  players: PlayerData[];
  lastUpdated: string;
  webpageTimestamp: string; // The actual timestamp from the webpage
}

/**
 * Historical snapshot structure stored in Vercel Blob
 */
export interface HistoricalSnapshot {
  date: string; // YYYY-MM-DD
  webpageTimestamp: string;
  players: PlayerData[];
  capturedAt: string; // ISO timestamp
}