import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Activity from '@/models/activity';
import { authenticate } from '@/lib/middleware/authenticate';
import { Types } from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Try to authenticate via Authorization header first
    const authResult = await authenticate(request as unknown as Request);
    let userId: string | null = null;

    if ((authResult as Response) instanceof Response) {
      // authResult is a Response (error), fallback to query param
      const url = new URL(request.url);
      userId = url.searchParams.get('userId');
      if (!userId) {
        return authResult as Response;
      }
    } else {
      // authResult is { userId }
      userId = String((authResult as any).userId);
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

    await connectToDatabase();

    const skip = (page - 1) * limit;

    // Query with both string and ObjectId to handle both storage formats
    const userQuery = Types.ObjectId.isValid(userId) 
      ? { $or: [{ user: userId }, { user: new Types.ObjectId(userId) }] }
      : { user: userId };
    
    const activities = await Activity.find(userQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json({ activities }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch activities', err);
    return NextResponse.json({ message: 'Failed to fetch activities' }, { status: 500 });
  }
}
