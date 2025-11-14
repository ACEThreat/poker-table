# Vercel Blob Troubleshooting Guide

## Issues Identified

After analyzing your codebase, I've identified several potential issues with your Vercel Blob operations:

### 1. **Missing or Inconsistent Blob Options**

**Problem:** Some blob operations are missing critical options like `addRandomSuffix`.

**Locations:**
- `lib/api/snapshot-management.ts` - `saveSnapshot()` uses `addRandomSuffix: false`
- `lib/api/country-management.ts` - `saveCountryMappings()` uses `addRandomSuffix: false`

**Issue:** While this is intentional for predictable file paths, it can cause problems if:
- Multiple concurrent writes happen simultaneously
- The blob doesn't exist yet and you're using `allowOverwrite`

**Fix:** Consider adding version control or timestamps to blob names.

---

### 2. **No Retry Logic for Blob Operations**

**Problem:** Blob operations can fail transiently (network issues, rate limits, etc.) but there's no retry mechanism.

**Affected Functions:**
- `loadCountryMappings()`
- `saveCountryMappings()`
- `loadSnapshot()`
- `saveSnapshot()`
- `getAvailableSnapshots()`

**Impact:** Temporary failures can cause data loss or inconsistency.

**Fix:** Implement retry logic with exponential backoff.

---

### 3. **List Operation Pagination Not Handled**

**Problem:** The `list()` function in `getAvailableSnapshots()` doesn't handle pagination.

**Location:** `lib/api/snapshot-management.ts:31`

```typescript
const { blobs } = await list({
  prefix: SNAPSHOTS_BLOB_PREFIX,
  // No pagination handling!
});
```

**Issue:** If you have more than 1000 blobs (default limit), some won't be returned.

**Fix:** Implement pagination with cursor-based fetching.

---

### 4. **Race Condition in Snapshot Updates**

**Problem:** Multiple concurrent requests could try to create today's snapshot simultaneously.

**Location:** `lib/api/snapshot-management.ts:195` - `updateDailySnapshot()`

```typescript
const existingSnapshot = await loadSnapshot(todayDate);
if (!existingSnapshot) {
  // Race condition here! Multiple requests could enter this block
  await saveSnapshot(newSnapshot);
}
```

**Impact:** Multiple writes to the same blob, potential data corruption.

**Fix:** Implement proper locking or use Vercel Blob's conditional writes.

---

### 5. **Inconsistent Error Handling**

**Problem:** Some blob operations catch errors and return empty data, others throw.

**Examples:**
- `loadCountryMappings()` returns `{}` on error
- `getAvailableSnapshots()` returns `[]` on error
- `loadSnapshot()` returns `null` on error

**Issue:** Makes it hard to distinguish between "no data" and "error loading data".

**Fix:** Use consistent error handling strategy with proper logging.

---

### 6. **Missing Cache Invalidation**

**Problem:** Country mappings use `cacheControlMaxAge: 0` but there might be CDN caching.

**Location:** `lib/api/country-management.ts:48`

```typescript
await put(COUNTRIES_BLOB_PATH, JSON.stringify(mappings, null, 2), {
  access: 'public',
  addRandomSuffix: false,
  contentType: 'application/json',
  cacheControlMaxAge: 0,  // This might not work as expected
  allowOverwrite: true,
});
```

**Issue:** Vercel's CDN might still cache the blob despite `cacheControlMaxAge: 0`.

**Fix:** Use versioned blob paths or add cache-busting query parameters.

---

### 7. **No Blob Cleanup Strategy**

**Problem:** Snapshots accumulate indefinitely with no cleanup mechanism.

**Impact:** 
- Increased storage costs
- Slower list operations
- Potential rate limit issues

**Fix:** Implement a cleanup strategy to remove old snapshots.

---

## Recommended Fixes

### Fix 1: Add Retry Logic

Create a new file `lib/api/blob-retry.ts`:

```typescript
type BlobOperation<T> = () => Promise<T>;

export async function retryBlobOperation<T>(
  operation: BlobOperation<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Blob operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

### Fix 2: Handle List Pagination

Update `getAvailableSnapshots()` in `lib/api/snapshot-management.ts`:

```typescript
export async function getAvailableSnapshots(): Promise<string[]> {
  try {
    const allBlobs: Array<{ pathname: string }> = [];
    let cursor: string | undefined;
    
    do {
      const { blobs, cursor: nextCursor } = await list({
        prefix: SNAPSHOTS_BLOB_PREFIX,
        limit: 1000,
        cursor,
      });
      
      allBlobs.push(...blobs);
      cursor = nextCursor;
    } while (cursor);
    
    const dates = allBlobs
      .map(blob => {
        const match = blob.pathname.match(/snapshots\/(\d{4}-\d{2}-\d{2})\.json$/);
        return match ? match[1] : null;
      })
      .filter((date): date is string => date !== null)
      .sort()
      .reverse();
    
    return dates;
  } catch (error) {
    console.error('Error listing snapshots from Blob:', error);
    return [];
  }
}
```

### Fix 3: Fix Race Condition with Atomic Check

Update `updateDailySnapshot()` in `lib/api/snapshot-management.ts`:

```typescript
export async function updateDailySnapshot(
  players: PlayerData[],
  webpageTimestamp: string
): Promise<void> {
  const todayDate = getTodayDate();
  
  // Use a more unique blob name to avoid race conditions
  const blobPath = `${SNAPSHOTS_BLOB_PREFIX}${todayDate}.json`;
  
  try {
    // Try to create the blob with addRandomSuffix: false
    // This will fail if it already exists (with allowOverwrite: false)
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
    
    await put(blobPath, JSON.stringify(newSnapshot, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      // Don't allow overwrite - let it fail if already exists
      // This prevents race conditions
    });
    
    console.log(`Snapshot saved to Blob: ${blobPath}`);
  } catch (error) {
    // If error is because blob already exists, that's fine
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log(`Snapshot for ${todayDate} already exists, skipping`);
    } else {
      console.error('Error saving snapshot to Blob:', error);
      throw error; // Re-throw other errors
    }
  }
}
```

### Fix 4: Add Cache-Busting for Country Mappings

Update `saveCountryMappings()` in `lib/api/country-management.ts`:

```typescript
export async function saveCountryMappings(mappings: Record<string, string | null>): Promise<void> {
  try {
    // Add version/timestamp to force cache invalidation
    const timestamp = Date.now();
    const blobPath = `${COUNTRIES_BLOB_PATH}?v=${timestamp}`;
    
    await put(blobPath, JSON.stringify(mappings, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 0,
      allowOverwrite: true,
    });
    console.log('Country mappings saved to Blob storage');
  } catch (error) {
    console.error('Error saving country mappings to Blob:', error);
    throw error; // Don't silently fail
  }
}
```

### Fix 5: Add Blob Cleanup Strategy

Create a new function in `lib/api/snapshot-management.ts`:

```typescript
/**
 * Clean up old snapshots (keep only last N days)
 * @param keepDays - Number of days to keep (default: 90)
 */
export async function cleanupOldSnapshots(keepDays: number = 90): Promise<void> {
  try {
    const dates = await getAvailableSnapshots();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    const cutoffString = cutoffDate.toISOString().split('T')[0];
    
    const toDelete = dates.filter(date => date < cutoffString);
    
    if (toDelete.length === 0) {
      console.log('No old snapshots to clean up');
      return;
    }
    
    console.log(`Cleaning up ${toDelete.length} old snapshot(s)`);
    
    for (const date of toDelete) {
      const blobPath = `${SNAPSHOTS_BLOB_PREFIX}${date}.json`;
      try {
        await del(blobPath);
        console.log(`Deleted old snapshot: ${blobPath}`);
      } catch (error) {
        console.error(`Failed to delete snapshot ${blobPath}:`, error);
      }
    }
  } catch (error) {
    console.error('Error during snapshot cleanup:', error);
  }
}
```

### Fix 6: Improve Error Handling

Create a unified error handling strategy in `lib/api/blob-errors.ts`:

```typescript
export class BlobError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
    public readonly operation?: string
  ) {
    super(message);
    this.name = 'BlobError';
  }
}

export function handleBlobError(error: unknown, operation: string): never {
  if (error instanceof Error) {
    throw new BlobError(`Blob operation failed: ${operation}`, error, operation);
  }
  throw new BlobError(`Blob operation failed: ${operation}`, error, operation);
}
```

---

## Testing Recommendations

1. **Test concurrent writes:** Simulate multiple requests trying to create the same snapshot
2. **Test pagination:** Create more than 1000 test snapshots to verify pagination works
3. **Test error recovery:** Simulate network failures and verify retry logic works
4. **Test cache invalidation:** Verify country mapping updates are reflected immediately
5. **Performance test:** Monitor blob operation response times under load

---

## Monitoring Recommendations

Add monitoring for:
- Blob operation success/failure rates
- Blob operation latency
- Number of stored blobs
- Storage costs
- Cache hit/miss rates

---

## Environment Variables to Add

```env
# Blob operation settings
BLOB_RETRY_MAX_ATTEMPTS=3
BLOB_RETRY_BASE_DELAY_MS=1000
BLOB_SNAPSHOT_RETENTION_DAYS=90
BLOB_ENABLE_CLEANUP=true
```

---

## Next Steps

1. ✅ Review this document
2. ⬜ Implement retry logic (highest priority)
3. ⬜ Fix pagination in list operations
4. ⬜ Address race condition in snapshot creation
5. ⬜ Implement blob cleanup strategy
6. ⬜ Add comprehensive error handling
7. ⬜ Add monitoring and alerting
8. ⬜ Test all fixes in staging environment
