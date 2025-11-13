/**
 * Script to manage player country codes stored in Vercel Blob
 * Run with: npx tsx scripts/manage-countries.ts [command]
 * 
 * Commands:
 *   sync    - Sync current players from latest snapshot and add missing ones
 *   list    - List all players and their country codes
 *   update  - Interactively update country codes for players
 *   migrate - Migrate from local config file to blob storage
 */

import dotenv from 'dotenv';
import { put, list, head } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';
import * as readline from 'readline';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const COUNTRIES_BLOB_PATH = 'countries.json';

interface CountryMappings {
  [playerName: string]: string | null; // ISO 3166-1 alpha-2 code or null for unknown
}

// Load country mappings from Vercel Blob
async function loadCountriesFromBlob(): Promise<CountryMappings> {
  try {
    const { blobs } = await list({
      prefix: COUNTRIES_BLOB_PATH,
      limit: 1,
    });
    
    if (blobs.length === 0) {
      console.log('ℹ️  No countries.json found in Blob storage. Starting fresh.');
      return {};
    }
    
    const response = await fetch(blobs[0].url, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error loading countries from Blob:', error);
    return {};
  }
}

// Save country mappings to Vercel Blob
async function saveCountriesToBlob(mappings: CountryMappings): Promise<void> {
  try {
    await put(COUNTRIES_BLOB_PATH, JSON.stringify(mappings, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 0,
    });
    console.log('✅ Countries saved to Blob storage');
  } catch (error) {
    console.error('Error saving countries to Blob:', error);
    throw error;
  }
}

// Get all unique player names from all snapshots in blob storage
async function getAllPlayerNames(): Promise<Set<string>> {
  const playerNames = new Set<string>();
  
  try {
    const { blobs } = await list({
      prefix: 'snapshots/',
    });
    
    console.log(`📦 Scanning ${blobs.length} snapshot(s) for players...`);
    
    for (const blob of blobs) {
      const response = await fetch(blob.url);
      if (response.ok) {
        const snapshot = await response.json();
        if (snapshot.players && Array.isArray(snapshot.players)) {
          snapshot.players.forEach((player: any) => {
            if (player.name) {
              playerNames.add(player.name);
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('Error scanning snapshots:', error);
  }
  
  return playerNames;
}

// Sync command: Add new players with null country codes
async function syncPlayers() {
  console.log('🔄 Syncing players from snapshots...\n');
  
  const mappings = await loadCountriesFromBlob();
  const allPlayers = await getAllPlayerNames();
  
  let addedCount = 0;
  
  for (const playerName of allPlayers) {
    if (!(playerName in mappings)) {
      mappings[playerName] = null;
      addedCount++;
      console.log(`➕ Added new player: ${playerName}`);
    }
  }
  
  if (addedCount > 0) {
    await saveCountriesToBlob(mappings);
    console.log(`\n✅ Added ${addedCount} new player(s)`);
  } else {
    console.log('\n✅ All players already in database');
  }
  
  console.log(`\n📊 Total players: ${Object.keys(mappings).length}`);
  console.log(`   🌍 With countries: ${Object.values(mappings).filter(c => c !== null).length}`);
  console.log(`   ❓ Without countries: ${Object.values(mappings).filter(c => c === null).length}`);
}

// List command: Display all players and their country codes
async function listPlayers() {
  console.log('📋 Current player country codes:\n');
  
  const mappings = await loadCountriesFromBlob();
  const entries = Object.entries(mappings).sort((a, b) => a[0].localeCompare(b[0]));
  
  if (entries.length === 0) {
    console.log('No players found. Run "sync" first.');
    return;
  }
  
  entries.forEach(([name, code]) => {
    const flag = code ? countryCodeToFlag(code) : '❓';
    const displayCode = code || 'null';
    console.log(`${flag}  ${name.padEnd(25)} → ${displayCode}`);
  });
  
  console.log(`\n📊 Total: ${entries.length} players`);
  console.log(`   🌍 With countries: ${entries.filter(([, c]) => c !== null).length}`);
  console.log(`   ❓ Without countries: ${entries.filter(([, c]) => c === null).length}`);
}

// Update command: Interactively update country codes
async function updatePlayers() {
  const mappings = await loadCountriesFromBlob();
  const players = Object.keys(mappings).sort();
  
  if (players.length === 0) {
    console.log('No players found. Run "sync" first.');
    return;
  }
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };
  
  console.log('🌍 Interactive Country Code Update');
  console.log('Enter 2-letter ISO country codes (or "skip" to skip, "done" to finish)\n');
  console.log('Common codes: US, GB, CA, AU, DE, FR, ES, IT, BR, MX, CN, JP, etc.\n');
  
  let updateCount = 0;
  
  for (const playerName of players) {
    const currentCode = mappings[playerName];
    const flag = currentCode ? countryCodeToFlag(currentCode) : '❓';
    const display = currentCode || 'none';
    
    const answer = await question(`${flag}  ${playerName} [${display}]: `);
    const input = answer.trim().toLowerCase();
    
    if (input === 'done') {
      console.log('\n✅ Stopping updates');
      break;
    }
    
    if (input === 'skip' || input === '') {
      continue;
    }
    
    if (input.length === 2) {
      const upperCode = input.toUpperCase();
      mappings[playerName] = upperCode;
      updateCount++;
      console.log(`   ✅ Updated to ${countryCodeToFlag(upperCode)} ${upperCode}`);
    } else {
      console.log('   ⚠️  Invalid code (must be 2 letters)');
    }
  }
  
  rl.close();
  
  if (updateCount > 0) {
    await saveCountriesToBlob(mappings);
    console.log(`\n✅ Updated ${updateCount} player(s)`);
  } else {
    console.log('\n✅ No changes made');
  }
}

// Migrate command: Migrate from local config file to blob storage
async function migrateFromLocalFile() {
  console.log('🔄 Migrating from local config file to Blob storage...\n');
  
  const localFile = path.join(process.cwd(), 'config', 'countries.json');
  
  try {
    const data = await fs.readFile(localFile, 'utf-8');
    const localMappings = JSON.parse(data);
    
    console.log(`📁 Found ${Object.keys(localMappings).length} entries in local file`);
    
    // Check if blob already exists
    const existingMappings = await loadCountriesFromBlob();
    
    if (Object.keys(existingMappings).length > 0) {
      const answer = await new Promise<string>((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question('⚠️  Blob storage already has data. Merge with local file? (y/n): ', (answer) => {
          rl.close();
          resolve(answer);
        });
      });
      
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Migration cancelled');
        return;
      }
      
      // Merge: local file takes precedence
      const merged = { ...existingMappings, ...localMappings };
      await saveCountriesToBlob(merged);
      console.log(`✅ Merged ${Object.keys(merged).length} total entries`);
    } else {
      await saveCountriesToBlob(localMappings);
      console.log('✅ Migrated to Blob storage');
    }
    
    // Now sync with all players from snapshots
    console.log('\n🔄 Syncing with all players from snapshots...');
    await syncPlayers();
    
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('❌ Local config file not found:', localFile);
      console.log('Run "sync" instead to start fresh from snapshots');
    } else {
      console.error('Error migrating:', error);
    }
  }
}

// Helper: Convert country code to flag emoji
function countryCodeToFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) {
    return '❓';
  }

  const code = countryCode.toUpperCase();
  const codePoints = [...code].map(char => 
    0x1F1E6 - 65 + char.charCodeAt(0)
  );
  
  return String.fromCodePoint(...codePoints);
}

// Main command handler
async function main() {
  const command = process.argv[2] || 'help';
  
  try {
    switch (command.toLowerCase()) {
      case 'sync':
        await syncPlayers();
        break;
      case 'list':
        await listPlayers();
        break;
      case 'update':
        await updatePlayers();
        break;
      case 'migrate':
        await migrateFromLocalFile();
        break;
      case 'help':
      default:
        console.log('🌍 Country Code Management Tool\n');
        console.log('Commands:');
        console.log('  sync    - Sync players from snapshots and add missing ones');
        console.log('  list    - List all players and their country codes');
        console.log('  update  - Interactively update country codes');
        console.log('  migrate - Migrate from local config file to Blob storage\n');
        console.log('Usage: npx tsx scripts/manage-countries.ts [command]');
        break;
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
