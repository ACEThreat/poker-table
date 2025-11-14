/**
 * Country management utilities for the leaderboard API
 * Handles loading, saving, and merging country codes for players
 */

import { put, list } from '@vercel/blob';
import { COUNTRIES_BLOB_PATH } from './constants';
import { PlayerData } from './types';

/**
 * Load country mappings from Vercel Blob storage
 * @returns Record mapping player names to country codes (null for unknown)
 */
export async function loadCountryMappings(): Promise<Record<string, string | null>> {
  try {
    // OPTIMIZATION: Use direct URL instead of expensive list() operation
    // This eliminates 1 advanced operation per request (5x cost reduction)
    const blobUrl = `https://${process.env.BLOB_READ_WRITE_TOKEN!.split('_')[0]}.public.blob.vercel-storage.com/${COUNTRIES_BLOB_PATH}`;
    
    const response = await fetch(blobUrl, {
      // Add cache control to leverage CDN
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('No countries.json found in Blob storage');
        return {};
      }
      throw new Error(`Failed to fetch countries: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error loading country mappings from Blob:', error);
    return {};
  }
}

/**
 * Save country mappings to Vercel Blob storage
 * @param mappings - Record mapping player names to country codes
 */
export async function saveCountryMappings(mappings: Record<string, string | null>): Promise<void> {
  try {
    await put(COUNTRIES_BLOB_PATH, JSON.stringify(mappings, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 0,
      allowOverwrite: true,
    });
    console.log('Country mappings saved to Blob storage');
  } catch (error) {
    console.error('Error saving country mappings to Blob:', error);
  }
}

/**
 * Merge country codes into player data and update mappings for new players
 * @param players - Array of player data without country codes
 * @returns Array of player data with country codes merged in
 */
export async function mergeCountryCodes(players: PlayerData[]): Promise<PlayerData[]> {
  const countryMappings = await loadCountryMappings();
  let needsUpdate = false;
  const newPlayers: string[] = [];
  
  // Check for new players and add them to mapping with null country code
  for (const player of players) {
    if (!(player.name in countryMappings)) {
      countryMappings[player.name] = null;
      needsUpdate = true;
      newPlayers.push(player.name);
    }
  }
  
  // Save updated mappings if new players were found (non-blocking)
  if (needsUpdate) {
    saveCountryMappings(countryMappings).catch(err => {
      console.error('Error auto-saving new players to countries:', err);
    });
    console.log(`Added ${newPlayers.length} new player(s) to country mappings:`, newPlayers);
  }
  
  // Merge country codes into player data
  // Note: null values are preserved so they can be shown as "?" emoji
  return players.map(player => ({
    ...player,
    countryCode: countryMappings[player.name] || null
  }));
}
