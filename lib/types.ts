/**
 * Shared type definitions for the poker leaderboard application
 */

/**
 * Player data structure representing a player's statistics
 */
export type Player = {
  rank: number;
  name: string;
  evWon: number;
  evBB100: number;
  won: number;
  hands: number;
  countryCode?: string; // ISO 3166-1 alpha-2 country code
  // Comparison fields (differences from previous day)
  rankChange?: number;
  evWonChange?: number;
  evBB100Change?: number;
  wonChange?: number;
  handsChange?: number;
};

/**
 * Type for sortable player properties
 */
export type SortKey = keyof Player;

/**
 * Sort direction for table columns
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Configuration for table sorting
 */
export type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

/**
 * Historical snapshot metadata
 */
export type HistoricalSnapshot = {
  date: string;
  webpageTimestamp: string;
  capturedAt: string;
};