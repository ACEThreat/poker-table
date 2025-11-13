# Country Code Management Guide

This guide explains how to manage player country codes for the poker leaderboard application.

## Overview

Player country codes are stored in **Vercel Blob Storage** at `countries.json`. The system automatically:
- Adds new players with `null` country codes (shown as ❓ emoji)
- Preserves country codes across all daily snapshots
- Merges country data into the leaderboard API responses

## Quick Start

### 1. Initial Setup (Migration from Local File)

If you have an existing `config/countries.json` file, migrate it to blob storage:

```bash
npx tsx scripts/manage-countries.ts migrate
```

This will:
- Upload your local country mappings to blob storage
- Sync with all players from snapshots
- Add any new players with `null` country codes

### 2. Sync New Players

After new players appear in the leaderboard, sync them to the country database:

```bash
npx tsx scripts/manage-countries.ts sync
```

This scans all snapshots in blob storage and adds any new players with `null` country codes.

### 3. View Current Country Codes

List all players and their assigned country codes:

```bash
npx tsx scripts/manage-countries.ts list
```

Example output:
```
📋 Current player country codes:

🇺🇸  JoeAdams                  → US
🇬🇧  DavyJones922              → GB
❓  asianflushie              → null
🇨🇦  iWasOnly17                → CA

📊 Total: 39 players
   🌍 With countries: 25
   ❓ Without countries: 14
```

### 4. Update Country Codes (Interactive)

Interactively assign country codes to players:

```bash
npx tsx scripts/manage-countries.ts update
```

This will prompt you for each player:
```
🌍 Interactive Country Code Update
Enter 2-letter ISO country codes (or "skip" to skip, "done" to finish)

❓  asianflushie [none]: cn
   ✅ Updated to 🇨🇳 CN
❓  KayhanMok [none]: tr
   ✅ Updated to 🇹🇷 TR
🇺🇸  JoeAdams [US]: skip
```

Commands during interactive update:
- Enter a 2-letter country code (e.g., `us`, `gb`, `ca`) to update
- Type `skip` or press Enter to skip the player
- Type `done` to stop and save changes

## Country Codes

Use **ISO 3166-1 alpha-2** country codes (2 letters):

### Common Codes
- `US` - United States 🇺🇸
- `GB` - United Kingdom 🇬🇧
- `CA` - Canada 🇨🇦
- `AU` - Australia 🇦🇺
- `DE` - Germany 🇩🇪
- `FR` - France 🇫🇷
- `ES` - Spain 🇪🇸
- `IT` - Italy 🇮🇹
- `BR` - Brazil 🇧🇷
- `MX` - Mexico 🇲🇽
- `JP` - Japan 🇯🇵
- `KR` - South Korea 🇰🇷
- `CN` - China 🇨🇳
- `IN` - India 🇮🇳
- `SE` - Sweden 🇸🇪
- `NO` - Norway 🇳🇴
- `DK` - Denmark 🇩🇰
- `FI` - Finland 🇫🇮
- `NL` - Netherlands 🇳🇱
- `PL` - Poland 🇵🇱
- `PT` - Portugal 🇵🇹
- `RU` - Russia 🇷🇺
- `TR` - Turkey 🇹🇷
- `AR` - Argentina 🇦🇷

[Full list of ISO country codes](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)

## Manual Editing (Advanced)

You can also manually edit the blob storage file:

1. **Download the current file:**
   - Go to your Vercel dashboard
   - Navigate to Storage → Blob
   - Find and download `countries.json`

2. **Edit the JSON:**
   ```json
   {
     "PlayerName1": "US",
     "PlayerName2": "GB",
     "PlayerName3": null,
     "NewPlayer": "CA"
   }
   ```

3. **Re-upload:**
   - Delete the old `countries.json` from blob storage
   - Upload your edited version with the same name `countries.json`

## How It Works

### Automatic Player Detection

The leaderboard API automatically:
1. Loads country mappings from blob storage
2. Checks if any players in the current leaderboard are missing from the country database
3. Adds new players with `null` country codes
4. Saves the updated mappings back to blob storage (non-blocking)

This means **new players are automatically added** every time they appear in the leaderboard.

### Country Display

- Players with assigned country codes show their flag emoji (e.g., 🇺🇸 🇬🇧 🇨🇦)
- Players with `null` country codes show the ❓ emoji
- The frontend uses the `countryCodeToFlag()` function from `lib/flags.ts`

### Data Storage

```
Blob Storage Structure:
├── countries.json          ← Player country mappings
└── snapshots/
    ├── 2025-11-10.json    ← Daily leaderboard snapshots
    ├── 2025-11-11.json    ← (no country codes stored here)
    └── 2025-11-12.json
```

Country codes are:
- ✅ Stored once in `countries.json`
- ✅ Merged at runtime into API responses
- ❌ NOT duplicated in daily snapshots

## Workflow Examples

### Daily Workflow
```bash
# 1. Check if new players appeared
npx tsx scripts/manage-countries.ts list

# 2. If there are players with ❓, update them
npx tsx scripts/manage-countries.ts update
```

### Bulk Update Workflow
```bash
# 1. Sync all players from snapshots
npx tsx scripts/manage-countries.ts sync

# 2. View the list
npx tsx scripts/manage-countries.ts list

# 3. Update interactively
npx tsx scripts/manage-countries.ts update
```

## Troubleshooting

### "No countries.json found in Blob storage"

This means the country database hasn't been created yet. Run:
```bash
npx tsx scripts/manage-countries.ts sync
```

### Players still showing ❓ after update

1. Verify the update was successful:
   ```bash
   npx tsx scripts/manage-countries.ts list
   ```

2. Clear the API cache by waiting 5 minutes or restarting the app

3. Check the browser's developer console for any errors

### Migration issues

If migration fails, you can manually create the initial file:
```bash
# Start fresh with sync
npx tsx scripts/manage-countries.ts sync

# Then update players
npx tsx scripts/manage-countries.ts update
```

## Environment Setup

Ensure your `.env.local` file has the Vercel Blob token:
```
BLOB_READ_WRITE_TOKEN=your_token_here
```

## Commands Reference

```bash
# Show help
npx tsx scripts/manage-countries.ts help

# Sync players from snapshots
npx tsx scripts/manage-countries.ts sync

# List all players and country codes
npx tsx scripts/manage-countries.ts list

# Interactive update
npx tsx scripts/manage-countries.ts update

# Migrate from local file
npx tsx scripts/manage-countries.ts migrate
