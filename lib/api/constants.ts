/**
 * Shared constants for the leaderboard API
 */

/**
 * Rate limiting configuration
 * NOTE: This in-memory rate limiting will reset on serverless cold starts.
 * For production deployments with strict rate limiting requirements, consider:
 * - Using Vercel KV (requires paid plan) for persistent rate limiting
 * - Implementing edge middleware with Vercel Edge Config
 * - Using a third-party rate limiting service
 * The current implementation provides basic protection but may be more lenient
 * than configured due to cold start resets.
 */
export const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
export const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Caching configuration
 * We use Next.js unstable_cache for serverless-compatible caching
 * Cache duration is set to 5 minutes, but smart timestamp checking
 * will update cache earlier if webpage content changes
 */
export const CACHE_DURATION = 60 * 5; // 5 minutes in seconds

/**
 * Vercel Blob storage paths
 */
export const COUNTRIES_BLOB_PATH = 'countries.json';
export const SNAPSHOTS_BLOB_PREFIX = 'snapshots/';

/**
 * External data source
 */
export const LEADERBOARD_URL = 'https://www.pokerstrategy.com/HSCGWP2025/';

/**
 * Request timeout configurations
 */
export const TIMESTAMP_FETCH_TIMEOUT = 5000; // 5 seconds for lightweight timestamp check
export const DATA_FETCH_TIMEOUT = 10000; // 10 seconds for full data fetch