/**
 * Zod validation schemas for runtime type checking
 * Provides validation at API boundaries and external data sources
 */

import { z } from 'zod';

/**
 * Player data schema with validation rules
 * Validates individual player statistics and changes
 */
export const PlayerSchema = z.object({
  rank: z.number()
    .int('Rank must be an integer')
    .positive('Rank must be positive')
    .describe('Player rank position'),
  
  name: z.string()
    .min(1, 'Player name is required')
    .max(100, 'Player name too long')
    .trim()
    .describe('Player name'),
  
  evWon: z.number()
    .finite('EV Won must be a finite number')
    .describe('Expected Value won'),
  
  evBB100: z.number()
    .finite('EV BB/100 must be a finite number')
    .describe('Expected Value per 100 big blinds'),
  
  won: z.number()
    .finite('Won amount must be a finite number')
    .describe('Total amount won'),
  
  hands: z.number()
    .int('Hands must be an integer')
    .nonnegative('Hands cannot be negative')
    .max(1000000000, 'Hands count exceeds maximum')
    .describe('Number of hands played'),
  
  countryCode: z.string()
    .length(2, 'Country code must be 2 characters')
    .nullable()
    .optional()
    .describe('ISO 3166-1 alpha-2 country code'),
  
  // Optional change indicators from previous day
  rankChange: z.number().int().optional().describe('Change in rank since previous day'),
  evWonChange: z.number().finite().optional().describe('Change in EV Won'),
  evBB100Change: z.number().finite().optional().describe('Change in EV BB/100'),
  wonChange: z.number().finite().optional().describe('Change in Won amount'),
  handsChange: z.number().int().optional().describe('Change in hands played'),
}).strict(); // Reject unexpected fields

/**
 * Infer TypeScript type from PlayerSchema
 */
export type ValidatedPlayer = z.infer<typeof PlayerSchema>;

/**
 * Cached leaderboard data structure schema
 * Validates the complete API response including metadata
 */
export const CachedDataSchema = z.object({
  players: z.array(PlayerSchema)
    .min(1, 'At least one player is required')
    .max(1000, 'Too many players in response')
    .describe('Array of player data'),
  
  lastUpdated: z.string()
    .datetime('Invalid lastUpdated timestamp')
    .describe('When the data was last updated'),
  
  webpageTimestamp: z.string()
    .min(1, 'Webpage timestamp is required')
    .describe('Timestamp from the source webpage'),
}).strict();

/**
 * Infer TypeScript type from CachedDataSchema
 */
export type ValidatedCachedData = z.infer<typeof CachedDataSchema>;

/**
 * Historical snapshot metadata schema (without players)
 * Used for snapshot listing endpoints
 */
export const HistoricalSnapshotMetadataSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .describe('Snapshot date in UTC'),
  
  webpageTimestamp: z.string()
    .min(1, 'Webpage timestamp is required')
    .describe('Original webpage timestamp'),
  
  capturedAt: z.string()
    .datetime('Invalid capturedAt timestamp')
    .describe('When the snapshot was captured'),
}).strict();

/**
 * Infer TypeScript type from HistoricalSnapshotMetadataSchema
 */
export type ValidatedHistoricalSnapshotMetadata = z.infer<typeof HistoricalSnapshotMetadataSchema>;

/**
 * Full historical snapshot schema (with players)
 * Used when loading complete snapshot data
 */
export const HistoricalSnapshotSchema = HistoricalSnapshotMetadataSchema.extend({
  players: z.array(PlayerSchema)
    .min(1, 'Snapshot must contain at least one player')
    .max(1000, 'Too many players in snapshot')
    .describe('Array of player data in snapshot'),
}).strict();

/**
 * Infer TypeScript type from HistoricalSnapshotSchema
 */
export type ValidatedHistoricalSnapshot = z.infer<typeof HistoricalSnapshotSchema>;

/**
 * Snapshot list response schema
 * Validates the /api/history endpoint response
 */
export const SnapshotListResponseSchema = z.object({
  snapshots: z.array(HistoricalSnapshotMetadataSchema)
    .describe('List of available snapshots'),
  
  count: z.number()
    .int()
    .nonnegative()
    .describe('Total number of snapshots'),
}).strict();

/**
 * Infer TypeScript type from SnapshotListResponseSchema
 */
export type ValidatedSnapshotListResponse = z.infer<typeof SnapshotListResponseSchema>;

/**
 * Leaderboard API response schema
 * Validates the /api/leaderboard endpoint response
 */
export const LeaderboardResponseSchema = z.object({
  players: z.array(PlayerSchema)
    .min(1, 'At least one player is required')
    .max(1000, 'Too many players in response')
    .describe('Array of player data'),
  
  lastUpdated: z.string()
    .datetime('Invalid lastUpdated timestamp')
    .describe('When the data was last updated'),
  
  webpageTimestamp: z.string()
    .min(1, 'Webpage timestamp is required')
    .describe('Timestamp from the source webpage'),
  
  hasPreviousDayData: z.boolean()
    .describe('Whether previous day data is available for comparison'),
  
  previousDayDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .nullable()
    .describe('Date of the previous snapshot used for comparison'),
  
  isHistorical: z.boolean()
    .default(false)
    .describe('Whether this is historical data'),
}).strict();

/**
 * Infer TypeScript type from LeaderboardResponseSchema
 */
export type ValidatedLeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

/**
 * Historical data API response schema
 * Validates the /api/history/[date] endpoint response
 */
export const HistoricalDataResponseSchema = z.object({
  players: z.array(PlayerSchema)
    .min(1, 'At least one player is required')
    .max(1000, 'Too many players in response')
    .describe('Array of player data'),
  
  capturedAt: z.string()
    .datetime('Invalid capturedAt timestamp')
    .describe('When the snapshot was captured'),
  
  webpageTimestamp: z.string()
    .min(1, 'Webpage timestamp is required')
    .describe('Timestamp from the source webpage'),
  
  isHistorical: z.boolean()
    .default(true)
    .describe('Whether this is historical data'),
  
  hasPreviousDayData: z.boolean()
    .default(false)
    .describe('Whether previous day data is available'),
  
  previousDayDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .describe('Date of the previous snapshot'),
}).strict();

/**
 * Infer TypeScript type from HistoricalDataResponseSchema
 */
export type ValidatedHistoricalDataResponse = z.infer<typeof HistoricalDataResponseSchema>;

/**
 * Helper function to safely parse data with Zod schema
 * Returns parsed data or null with error logging
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param context - Context string for error logging
 * @returns Parsed data or null if validation fails
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T | null {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    console.error(`[Validation Error] ${context}:`, {
      errors: result.error.issues,
      data: JSON.stringify(data, null, 2).substring(0, 500), // Log first 500 chars
    });
    return null;
  }
  
  return result.data;
}

/**
 * Helper function to validate data with Zod schema and throw on error
 * Use this when validation failure should halt execution
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param context - Context string for error messages
 * @returns Parsed and validated data
 * @throws Error if validation fails
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errorMessages = result.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    
    throw new Error(`${context} - Validation failed: ${errorMessages}`);
  }
  
  return result.data;
}
