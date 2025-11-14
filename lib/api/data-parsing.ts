/**
 * Data parsing and validation utilities for the leaderboard API
 * Handles scraping, parsing, and sanitizing data from external sources
 */

import * as cheerio from 'cheerio';
import { LEADERBOARD_URL, TIMESTAMP_FETCH_TIMEOUT } from './constants';

/**
 * Parse the "Leaderboard last updated" timestamp from the webpage HTML
 * @param html - Raw HTML content from the webpage
 * @returns Parsed timestamp string or null if not found
 */
export function parseWebpageTimestamp(html: string): string | null {
  try {
    const $ = cheerio.load(html);
    // Look for the text containing "Leaderboard last updated"
    const timestampText = $('body').text();
    const match = timestampText.match(/Leaderboard last updated\s+([A-Za-z]+\s+\d+,?\s+\d+:\d+\s+[A-Z]+)/i);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  } catch (error) {
    console.error('Error parsing webpage timestamp:', error);
    return null;
  }
}

/**
 * Fetch only the timestamp from the webpage (lightweight check)
 * This is NOT cached to allow quick checks for content updates
 * @returns Webpage timestamp or null if fetch fails
 */
export async function fetchWebpageTimestamp(): Promise<string | null> {
  try {
    const response = await fetch(LEADERBOARD_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(TIMESTAMP_FETCH_TIMEOUT),
      cache: 'no-store' // Ensure we always get fresh timestamp
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return parseWebpageTimestamp(html);
  } catch (error) {
    console.error('Error fetching webpage timestamp:', error);
    return null;
  }
}

/**
 * Sanitize string input to prevent XSS and injection attacks
 * @param input - Raw string input
 * @returns Sanitized string with limited length
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove JavaScript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 200); // Limit length
}

/**
 * Sanitize and parse numeric input
 * @param input - Raw string input containing a number
 * @param isInteger - Whether to parse as integer (default: false)
 * @returns Parsed number or 0 if invalid
 */
export function sanitizeNumber(input: string, isInteger = false): number {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const num = isInteger ? parseInt(cleaned) : parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}