import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * Cache Revalidation Endpoint
 * Clears the snapshot-list cache to force fresh data
 * Visit: /api/revalidate-cache
 */
export async function GET() {
  try {
    // Revalidate the snapshot-list cache tag
    revalidateTag('snapshot-list');
    
    console.log('✅ Cache revalidated for snapshot-list');
    
    return NextResponse.json({
      success: true,
      message: 'Cache revalidated successfully',
      revalidated: ['snapshot-list'],
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      }
    });
  } catch (error: any) {
    console.error('❌ Error revalidating cache:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      }
    });
  }
}
