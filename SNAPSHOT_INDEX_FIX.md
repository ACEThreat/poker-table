# Snapshot Index Fix - November 16, 2025

## Issue Summary
Historical data was showing only 3 days instead of the full 8 days available in storage.

## Root Cause
The `snapshots/index.json` file was out of sync with actual blob storage:
- **Storage had:** 8 snapshot files (2025-11-10 through 2025-11-17)
- **Index had:** Only 3 entries (2025-11-17, 2025-11-16, 2025-11-15)
- **Result:** Users only saw 3 dates in the historical dropdown

## Why This Happened
The index.json file is used by the `/api/history` endpoint to quickly list available dates without scanning all blob files (costly operation). However, the index can become outdated if:

1. Snapshots are manually deleted from Vercel Blob storage
2. The `updateSnapshotIndex()` function fails silently during snapshot creation
3. The index file gets corrupted or partially updated
4. Manual snapshot files are uploaded without updating the index

## The Fix
Created two diagnostic/repair endpoints:

### 1. `/api/debug-snapshots`
- Lists all actual snapshot files in blob storage
- Shows what the index thinks exists
- Compares and identifies mismatches
- **Use this to diagnose future issues**

### 2. `/api/rebuild-index`
- Scans all snapshot files in blob storage
- Rebuilds the index.json from scratch
- Returns summary of what was found and fixed
- **Use this to fix sync issues**

## Resolution
Date: November 16, 2025, 9:06 PM PST

Ran: `https://bettercgwc.xyz/api/rebuild-index`

Result:
```json
{
  "success": true,
  "totalSnapshots": 8,
  "dateRange": "2025-11-10 to 2025-11-17",
  "dates": [
    "2025-11-17", "2025-11-16", "2025-11-15", "2025-11-14",
    "2025-11-13", "2025-11-12", "2025-11-11", "2025-11-10"
  ],
  "successCount": 8,
  "errorCount": 0
}
```

Verification: `https://bettercgwc.xyz/api/debug-snapshots`
```
"analysis": {
  "mismatch": false,
  "missingInIndex": [],
  "missingInStorage": [],
  "recommendation": "✅ Index is in sync with storage"
}
```

## Prevention

### 1. Never manually delete snapshots
If you need to delete old snapshots:
1. Delete from Vercel Blob Dashboard
2. Immediately run `/api/rebuild-index`

### 2. Monitor index health
Periodically check `/api/debug-snapshots` to ensure index is in sync

### 3. Automatic index updates
The `saveSnapshot()` function in `lib/api/snapshot-management.ts` automatically updates the index when creating new snapshots. However, if this fails silently, the index becomes outdated.

### 4. Handle errors properly
Update `updateSnapshotIndex()` to:
- Log failures more prominently
- Retry on failure
- Alert if index update fails

## Future Improvements

### Option 1: Self-healing index
Modify `/api/history/route.ts` to occasionally verify index integrity and auto-rebuild if needed:

```typescript
// Every 100th request, verify index
if (Math.random() < 0.01) {
  const actual = await listActualSnapshots();
  if (actual.length !== index.length) {
    await rebuildIndex();
  }
}
```

### Option 2: Version the index
Add a version field to track index updates:

```json
{
  "version": 2,
  "lastUpdated": "...",
  "snapshots": [...]
}
```

### Option 3: Scheduled maintenance
Set up a Vercel cron job to rebuild index daily:

```typescript
// app/api/cron/rebuild-index/route.ts
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Rebuild index logic
}
```

## Commands Reference

### Check index health:
```bash
curl https://bettercgwc.xyz/api/debug-snapshots | jq '.analysis'
```

### Rebuild index:
```bash
curl https://bettercgwc.xyz/api/rebuild-index
```

### View all available dates:
```bash
curl https://bettercgwc.xyz/api/debug-snapshots | jq '.storage.dates'
```

## Files Modified
- Created: `app/api/debug-snapshots/route.ts`
- Created: `app/api/rebuild-index/route.ts`
- Documentation: `SNAPSHOT_INDEX_FIX.md`

## Related Issues
- Historical data only showed 3 days (expected 5+)
- Index was resetting/losing entries
- Cached data showing phantom dates
