import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Activity from '@/models/activity';
import { authenticate } from '@/lib/middleware/authenticate';
import { cache, CACHE_TTL, cacheTags } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authenticate the teacher
    const authResult = await authenticate(request as unknown as Request);
    let userId: string | null = null;

    if ((authResult as Response) instanceof Response) {
      return authResult as Response;
    } else {
      userId = String((authResult as any).userId);
    }

    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') || 'all';
    const timeRange = url.searchParams.get('timeRange') || '30days';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

    // Check cache first
    const cacheKey = `teacher:history:${userId}:${filter}:${timeRange}:${page}:${limit}`;
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({ 
        success: true,
        activities: cachedData,
        cached: true
      }, { status: 200 });
    }

    await connectToDatabase();

    const skip = (page - 1) * limit;

    // Build query
    const query: any = { user: userId };

    // Filter by activity type
    if (filter !== 'all') {
      query.type = new RegExp(`^${filter}`, 'i');
    }

    // Filter by time range
    if (timeRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }

      query.createdAt = { $gte: startDate };
    }

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Cache for 30 seconds
    cache.set(cacheKey, activities, {
      ttl: CACHE_TTL.SHORT,
      tags: [cacheTags.user(userId)]
    });

    return NextResponse.json({ 
      success: true,
      activities,
      cached: false
    }, { status: 200 });
  } catch (err) {
    console.error('Failed to fetch teacher activities', err);
    return NextResponse.json({ 
      success: false,
      message: 'Failed to fetch activities' 
    }, { status: 500 });
  }
}
