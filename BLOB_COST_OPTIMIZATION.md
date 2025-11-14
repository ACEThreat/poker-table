# Vercel Blob Cost Optimization Guide

## 🚨 CRITICAL ISSUE: High Advanced Operations Usage

According to [Vercel Blob Pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing):
- **Class A Operations (Advanced)**: `list()`, `head()`, metadata operations - **$0.0135 per 1,000 operations**
- **Class B Operations (Basic)**: `put()`, `get()`, reads/writes - **$0.0027 per 1,000 operations**

**Advanced operations are 5x more expensive than basic operations!**

---

## Major Cost Issues Found

### 🔴 CRITICAL: Issue #1 - Expensive Snapshot List Fetching

**Location:** `app/api/history/route.ts:20-51`

**Problem:**
```typescript
const { blobs } = await list({
  prefix: 'snapshots/',
});

const snapshots: HistoricalSnapshot[] = [];

for (const blob of blobs) {
  if (blob.pathname.endsWith('.json')) {
    const response = await fetch(blob.url);  // Fetching FULL content!
    const data = await response.json();
    snapshots.push({
      date: data.date,
      webpageTimestamp: data.webpageTimestamp,
      capturedAt: data.capturedAt
    });
  }
}
```

**Cost Impact:**
- **1 list() operation** per request (even with caching, cache misses are expensive)
- **N fetch operations** (one per snapshot) - if you have 100 snapshots, that's 100 reads!
- This endpoint is hit every time someone views the history selector
- **Estimated cost:** If hit 1000x/day with 50 snapshots = 1,000 list() + 50,000 reads = **$1.40/day just for this!**

---

### 🔴 CRITICAL: Issue #2 - Repeated list() Calls in Snapshot Management

**Location:** `lib/api/snapshot-management.ts`

**Problem:**
```typescript
// Called frequently from multiple places
export async function getAvailableSnapshots(): Promise<string[]> {
  const { blobs } = await list({
    prefix: SNAPSHOTS_BLOB_PREFIX,
  });
  // ... processes blobs
}

// Also calls list() AGAIN
export async function loadSnapshot(date: string): Promise<HistoricalSnapshot | null> {
  const { blobs } = await list({
    prefix: `${SNAPSHOTS_BLOB_PREFIX}${date}.json`,
    limit: 1,
  });
  // ...
}
```

**Cost Impact:**
- Every API request that loads a snapshot calls `list()` at least once
- `loadPreviousDaySnapshot()` calls `getAvailableSnapshots()` (list) then `loadSnapshot()` (another list)
- **2 list() operations per snapshot load** instead of 0 (if we used direct URLs)

---

### 🟡 MODERATE: Issue #3 - Country Mappings list() Call

**Location:** `lib/api/country-management.ts:16`

```typescript
export async function loadCountryMappings() {
  const { blobs } = await list({
    prefix: COUNTRIES_BLOB_PATH,
    limit: 1,
  });
  // ...
}
```

**Cost Impact:**
- Called on EVERY leaderboard API request
- Unnecessary `list()` when filename is known

---

### 🟡 MODERATE: Issue #4 - Fetching Full Blob Content for Metadata

**Problem:** Fetching entire JSON files just to read date/timestamp metadata.

**Impact:** Wastes bandwidth and increases read operations cost.

---

## Optimization Strategies

### 💰 Strategy #1: Use Direct Blob URLs (Eliminates list() calls)

**Savings: ~95% reduction in advanced operations**

Since your blob paths are predictable (`snapshots/YYYY-MM-DD.json`), you don't need `list()` at all!

#### Fix for loadSnapshot():

```typescript
import { head } from '@vercel/blob';

export async function loadSnapshot(date: string): Promise<HistoricalSnapshot | null> {
  try {
    const blobPath = `${SNAPSHOTS_BLOB_PREFIX}${date}.json`;
    const blobUrl = `${process.env.BLOB_READ_WRITE_TOKEN}/${blobPath}`;
    
    // Direct URL fetch - NO list() needed!
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const validatedSnapshot = safeValidate(
      HistoricalSnapshotSchema,
      data,
      `Snapshot validation for date ${date}`
    );
    
    return validatedSnapshot || null;
  } catch (error) {
    console.error('Error loading snapshot:', error);
    return null;
  }
}
```

**Cost savings:** Eliminates 1 list() operation per snapshot load.

---

### 💰 Strategy #2: Store Metadata in Blob Custom Metadata

**Savings: Eliminates need to fetch full content for metadata**

Use Vercel Blob's custom metadata feature instead of fetching full JSON:

```typescript
// When saving snapshot, include metadata
await put(blobPath, JSON.stringify(snapshot, null, 2), {
  access: 'public',
  addRandomSuffix: false,
  contentType: 'application/json',
  // Add custom metadata
  customMetadata: {
    date: snapshot.date,
    webpageTimestamp: snapshot.webpageTimestamp,
    capturedAt: snapshot.capturedAt,
    playerCount: snapshot.players.length.toString()
  }
});

// Then use head() to read only metadata
const { customMetadata } = await head(blobUrl);
```

**Note:** `head()` is still an advanced operation but cheaper than fetching full content.

---

### 💰 Strategy #3: Cache Available Snapshots in Database/KV

**Savings: 99% reduction in list() calls**

Instead of calling `list()` every time, maintain a list of available dates:

```typescript
// Use Vercel KV or a simple JSON file
import { kv } from '@vercel/kv';

// When saving a new snapshot
await kv.sadd('snapshot-dates', todayDate);

// When fetching available snapshots
const dates = await kv.smembers('snapshot-dates');
// Sort and return - NO list() call needed!
```

**Cost:** Vercel KV operations are much cheaper than Blob list() operations.

---

### 💰 Strategy #4: Optimize History Route to Not Fetch All Blobs

**Current:** Fetches content of ALL snapshots to get metadata  
**Better:** Store snapshot list separately or use metadata

#### Immediate Fix for app/api/history/route.ts:

```typescript
import { kv } from '@vercel/kv';

const getCachedSnapshotList = unstable_cache(
  async (): Promise<SnapshotListResult> => {
    // Option A: Use KV store
    const dates = await kv.smembers('snapshot-dates');
    const snapshots = dates.map(date => ({
      date,
      // Fetch metadata from another KV key if needed
      webpageTimestamp: '', // Store this separately
      capturedAt: '' // Store this separately
    }));
    
    // Option B: Maintain a separate metadata file
    const metadataUrl = `${process.env.BLOB_READ_WRITE_TOKEN}/snapshots/metadata.json`;
    const response = await fetch(metadataUrl);
    const metadata = await response.json();
    
    return {
      snapshots: metadata.snapshots,
      count: metadata.snapshots.length
    };
  },
  ['snapshot-list'],
  { revalidate: 300 }
);
```

**Cost savings:** Eliminates 1 list() + N fetches. Reduces to 1 simple read operation.

---

### 💰 Strategy #5: Fix Country Mappings Loading

```typescript
export async function loadCountryMappings(): Promise<Record<string, string | null>> {
  try {
    // Direct URL - NO list() needed
    const blobUrl = `${process.env.BLOB_READ_WRITE_TOKEN}/${COUNTRIES_BLOB_PATH}`;
    
    const response = await fetch(blobUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.log('No countries.json found in Blob storage');
        return {};
      }
      throw new Error(`Failed to fetch countries: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error loading country mappings:', error);
    return {};
  }
}
```

**Cost savings:** Eliminates 1 list() operation per leaderboard request.

---

### 💰 Strategy #6: Batch Operations and Cache Aggressively

```typescript
// Cache the full list of snapshots for longer
const getCachedSnapshotDates = unstable_cache(
  async (): Promise<string[]> => {
    // Only refresh once per hour instead of every 5 minutes
    const { blobs } = await list({ prefix: 'snapshots/' });
    return blobs
      .map(blob => blob.pathname.match(/(\d{4}-\d{2}-\d{2})/)?.[1])
      .filter(Boolean)
      .sort()
      .reverse();
  },
  ['snapshot-dates'],
  { revalidate: 3600 } // Cache for 1 hour
);
```

---

## Implementation Priority

### Phase 1: Quick Wins (Implement Today)
1. ✅ **Fix country mappings** - Use direct URL instead of list()
2. ✅ **Fix loadSnapshot()** - Use direct URL instead of list()  
3. ✅ **Increase cache duration** for snapshot list from 5min to 1 hour

**Estimated savings:** ~70% reduction in advanced operations

### Phase 2: Medium-term (This Week)
4. ⬜ **Implement metadata-only endpoint** for history route
5. ⬜ **Add custom metadata** to blobs for quick access
6. ⬜ **Create snapshot index file** to avoid list() calls

**Estimated savings:** ~90% reduction in advanced operations

### Phase 3: Long-term (Next Sprint)
7. ⬜ **Move to Vercel KV** for snapshot date tracking
8. ⬜ **Implement proper metadata database** (Postgres/KV)
9. ⬜ **Add real-time monitoring** of blob operation costs

**Estimated savings:** ~95% reduction in advanced operations

---

## Cost Calculation

### Current Estimated Costs (per 1,000 requests)

| Operation | Count | Cost per 1k ops | Total |
|-----------|-------|-----------------|-------|
| list() calls | 3-5 | $0.0135 | $0.040-$0.068 |
| blob reads | 50-100 | $0.0027 | $0.135-$0.270 |
| **Total per 1k requests** | | | **$0.175-$0.338** |

**Monthly cost (100k requests):** $17.50-$33.80/month

### After Optimization (per 1,000 requests)

| Operation | Count | Cost per 1k ops | Total |
|-----------|-------|-----------------|-------|
| list() calls | 0 | $0.0135 | $0.000 |
| blob reads | 2-3 | $0.0027 | $0.005-$0.008 |
| **Total per 1k requests** | | | **$0.005-$0.008** |

**Monthly cost (100k requests):** $0.50-$0.80/month

**Savings: ~$17-$33/month (95% reduction!)**

---

## Monitoring & Alerts

Add these environment variables to track usage:

```env
# Enable blob operation logging
BLOB_TRACK_OPERATIONS=true
BLOB_LOG_EXPENSIVE_OPS=true
BLOB_COST_ALERT_THRESHOLD=100
```

Create a monitoring dashboard:
```typescript
// lib/api/blob-monitor.ts
export function trackBlobOperation(type: 'list' | 'read' | 'write', path: string) {
  if (process.env.BLOB_TRACK_OPERATIONS === 'true') {
    console.log(`[BLOB] ${type.toUpperCase()}: ${path}`);
  }
}
```

---

## Action Items

### Immediate (Today)
- [ ] Update `loadCountryMappings()` to use direct URL
- [ ] Update `loadSnapshot()` to use direct URL
- [ ] Remove unnecessary `list()` call from `loadSnapshot()`
- [ ] Increase cache duration for snapshot list

### This Week
- [ ] Refactor `app/api/history/route.ts` to not fetch all blobs
- [ ] Create separate metadata.json file for snapshot list
- [ ] Add custom metadata to future blob uploads
- [ ] Implement blob operation monitoring

### Next Sprint
- [ ] Evaluate Vercel KV for metadata storage
- [ ] Create cost alerting system
- [ ] Document all blob access patterns
- [ ] Set up automated cost reports

---

## Verification

After implementing fixes, verify savings:

1. Check Vercel dashboard for blob operation metrics
2. Monitor over 24-48 hours
3. Compare before/after costs
4. Adjust cache durations as needed

Target: **< 100 advanced operations per 1,000 requests**
