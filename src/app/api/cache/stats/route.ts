import { NextRequest, NextResponse } from 'next/server';
import { cache, cacheTags } from '@/lib/cache';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/cache/stats
 * Get cache statistics (admin/teacher only)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Only teachers and coordinators can view cache stats
    const authzResult = await authorize(authResult.userId, ['teacher', 'coordinator']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    const stats = cache.getStats();

    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cache/stats
 * Clear cache (admin/coordinator only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Only coordinators can clear cache
    const authzResult = await authorize(authResult.userId, ['coordinator']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');

    if (tag) {
      // Clear by tag
      const count = cache.invalidateByTag(tag);
      return NextResponse.json({
        success: true,
        message: `Cleared ${count} cache entries with tag: ${tag}`
      });
    } else {
      // Clear all
      cache.clear();
      return NextResponse.json({
        success: true,
        message: 'Cache cleared successfully'
      });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
