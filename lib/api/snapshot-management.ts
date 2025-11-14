/**
 * Snapshot management utilities for the leaderboard API
 * Handles loading, saving, and managing historical snapshots
 */

import { put, list } from '@vercel/blob';
import { SNAPSHOTS_BLOB_PREFIX } from './constants';
import { HistoricalSnapshot, PlayerData } from './types';
import { HistoricalSnapshotSchema, safeValidate } from '@/lib/schemas';

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 * @returns Today's date string
 */
export function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get all available snapshot dates from Vercel Blob storage
 * @returns Array of date strings (YYYY-MM-DD) sorted in descending order
 */
export async function getAvailableSnapshots(): Promise<string[]> {
  try {
    const { blobs } = await list({
      prefix: SNAPSHOTS_BLOB_PREFIX,
    });
    
    const dates = blobs
      .map(blob => {
        // Extract date from path like "snapshots/2025-11-10.json"
        const match = blob.pathname.match(/snapshots\/(\d{4}-\d{2}-\d{2})\.json$/);
        return match ? match[1] : null;
      })
      .filter((date): date is string => date !== null)
      .sort()
      .reverse(); // Most recent first
    
    return dates;
  } catch (error) {
    console.error('Error listing snapshots from Blob:', error);
    return [];
  }
}

/**
 * Load snapshot for a specific date from Vercel Blob storage
 * @param date - Date string in YYYY-MM-DD format
 * @returns Historical snapshot or null if not found
 */
export async function loadSnapshot(date: string): Promise<HistoricalSnapshot | null> {
  try {
    const { blobs } = await list({
      prefix: `${SNAPSHOTS_BLOB_PREFIX}${date}.json`,
      limit: 1,
    });
    
    if (blobs.length === 0) {
      return null;
    }
    
    const response = await fetch(blobs[0].url);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Validate snapshot data before returning
    const validatedSnapshot = safeValidate(
      HistoricalSnapshotSchema,
      data,
      `Snapshot validation for date ${date}`
    );
    
    if (!validatedSnapshot) {
      console.error(`Invalid snapshot data for ${date}, skipping`);
      return null;
    }
    
    return validatedSnapshot;
  } catch (error) {
    console.error('Error loading snapshot from Blob:', error);
    return null;
  }
}

/**
 * Load the most recent snapshot (for comparison)
 * Excludes today's snapshot to get the previous day's data
 * @returns The most recent historical snapshot or null if none exists
 */
export async function loadPreviousDaySnapshot(): Promise<HistoricalSnapshot | null> {
  const dates = await getAvailableSnapshots();
  const today = getTodayDate();
  
  // Find the most recent snapshot that's not today
  for (const date of dates) {
    if (date !== today) {
      return loadSnapshot(date);
    }
  }
  
  return null;
}

/**
 * Save snapshot to Vercel Blob storage
 * @param snapshot - Historical snapshot to save
 */
export async function saveSnapshot(snapshot: HistoricalSnapshot): Promise<void> {
  try {
    // Validate snapshot data before saving
    const validatedSnapshot = safeValidate(
      HistoricalSnapshotSchema,
      snapshot,
      'Snapshot validation before save'
    );
    
    if (!validatedSnapshot) {
      throw new Error('Invalid snapshot data, refusing to save');
    }
    
    const blobPath = `${SNAPSHOTS_BLOB_PREFIX}${snapshot.date}.json`;
    await put(blobPath, JSON.stringify(validatedSnapshot, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    console.log(`Snapshot saved to Blob: ${blobPath}`);
  } catch (error) {
    console.error('Error saving snapshot to Blob:', error);
  }
}

/**
 * Compare current data with previous snapshot and add change indicators
 * @param currentPlayers - Current player data
 * @param previousSnapshot - Previous day's snapshot for comparison
 * @returns Player data with change indicators added
 */
export function calculateChanges(
  currentPlayers: PlayerData[],
  previousSnapshot: HistoricalSnapshot | null
): PlayerData[] {
  if (!previousSnapshot) {
    return currentPlayers;
  }

  const previousMap = new Map<string, PlayerData>();
  previousSnapshot.players.forEach(player => {
    previousMap.set(player.name, player);
  });

  return currentPlayers.map(currentPlayer => {
    const previousPlayer = previousMap.get(currentPlayer.name);
    
    if (!previousPlayer) {
      // New player, no comparison available
      return currentPlayer;
    }

    return {
      ...currentPlayer,
      rankChange: previousPlayer.rank - currentPlayer.rank, // Positive if moved up
      evWonChange: currentPlayer.evWon - previousPlayer.evWon,
      evBB100Change: currentPlayer.evBB100 - previousPlayer.evBB100,
      wonChange: currentPlayer.won - previousPlayer.won,
      handsChange: currentPlayer.hands - previousPlayer.hands
    };
  });
}

/**
 * Check if we need to update the daily snapshot and save if needed
 * Only saves a new snapshot if today's snapshot doesn't exist yet
 * @param players - Current player data (without change indicators)
 * @param webpageTimestamp - Timestamp from the source webpage
 */
export async function updateDailySnapshot(
  players: PlayerData[],
  webpageTimestamp: string
): Promise<void> {
  const todayDate = getTodayDate();
  const existingSnapshot = await loadSnapshot(todayDate);

  // Only save a new snapshot if today's snapshot doesn't exist yet
  if (!existingSnapshot) {
    const newSnapshot: HistoricalSnapshot = {
      date: todayDate,
      webpageTimestamp,
      players: players.map(p => ({
        rank: p.rank,
        name: p.name,
        evWon: p.evWon,
        evBB100: p.evBB100,
        won: p.won,
        hands: p.hands
      })),
      capturedAt: new Date().toISOString()
    };
    await saveSnapshot(newSnapshot);
  }
}