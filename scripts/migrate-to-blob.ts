/**
 * Migration script to upload existing snapshots to Vercel Blob
 * Run this locally with: npx tsx scripts/migrate-to-blob.ts
 */

import dotenv from 'dotenv';
import { put, list } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const SNAPSHOTS_DIR = path.join(process.cwd(), '.cache', 'leaderboard', 'snapshots');

async function migrateSnapshots() {
  console.log('🚀 Starting migration to Vercel Blob...\n');

  try {
    // Check if snapshots directory exists
    try {
      await fs.access(SNAPSHOTS_DIR);
    } catch {
      console.error('❌ Snapshots directory not found:', SNAPSHOTS_DIR);
      process.exit(1);
    }

    // Get list of existing blobs
    const { blobs: existingBlobs } = await list({ prefix: 'snapshots/' });
    const existingDates = new Set(
      existingBlobs.map(blob => {
        const match = blob.pathname.match(/snapshots\/(\d{4}-\d{2}-\d{2})\.json$/);
        return match ? match[1] : null;
      }).filter(Boolean)
    );

    console.log(`📦 Found ${existingDates.size} existing snapshots in Blob storage\n`);

    // Read all local snapshot files
    const files = await fs.readdir(SNAPSHOTS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    console.log(`📁 Found ${jsonFiles.length} local snapshot files\n`);

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    // Upload each file
    for (const file of jsonFiles) {
      const date = file.replace('.json', '');
      
      // Skip if already exists in Blob
      if (existingDates.has(date)) {
        console.log(`⏭️  Skipping ${date} (already exists in Blob)`);
        skipped++;
        continue;
      }

      try {
        const filePath = path.join(SNAPSHOTS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Validate JSON
        JSON.parse(content);

        // Upload to Blob
        const blobPath = `snapshots/${file}`;
        await put(blobPath, content, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
        });

        console.log(`✅ Uploaded ${date}`);
        uploaded++;
      } catch (error) {
        console.error(`❌ Failed to upload ${date}:`, error);
        failed++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Uploaded: ${uploaded}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📦 Total in Blob: ${existingDates.size + uploaded}`);
    
    if (failed === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateSnapshots();
