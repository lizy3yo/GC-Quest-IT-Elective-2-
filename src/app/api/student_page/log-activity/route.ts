import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, action, meta, progress } = body;

    if (!userId || !type || !action) {
      return NextResponse.json(
        { message: 'Missing required fields: userId, type, action' },
        { status: 400 }
      );
    }

    await logActivity({ userId, type, action, meta, progress });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Failed to log activity', err);
    return NextResponse.json(
      { message: 'Failed to log activity' },
      { status: 500 }
    );
  }
}
