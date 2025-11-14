/**
 * Rate limiting utilities for the leaderboard API
 * Provides in-memory rate limiting and request logging
 */

import { RATE_LIMIT_WINDOW, MAX_REQUESTS_PER_WINDOW } from './constants';

/**
 * In-memory request log for rate limiting
 * Maps IP addresses to arrays of request timestamps
 * 
 * NOTE: This in-memory rate limiting will reset on serverless cold starts.
 * For production deployments with strict rate limiting requirements, consider:
 * - Using Vercel KV (requires paid plan) for persistent rate limiting
 * - Implementing edge middleware with Vercel Edge Config
 * - Using a third-party rate limiting service
 * The current implementation provides basic protection but may be more lenient
 * than configured due to cold start resets.
 */
const requestLog = new Map<string, number[]>();

/**
 * Check if a request from an IP address should be rate limited
 * @param ip - Client IP address
 * @returns true if request is allowed, false if rate limit exceeded
 */
export function checkRateLimit(ip: string): boolean {
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

/**
 * Log request details to console in JSON format
 * @param ip - Client IP address
 * @param status - Request status (success, error, or rate-limited)
 * @param details - Optional additional details about the request
 */
export function logRequest(
  ip: string,
  status: 'success' | 'error' | 'rate-limited',
  details?: string
): void {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    ip,
    status,
    endpoint: '/api/leaderboard',
    details: details || 'N/A'
  }));
}