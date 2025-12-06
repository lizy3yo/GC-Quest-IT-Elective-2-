import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Activity from '@/models/activity';
import { Summary } from '@/models/summary';
import { logger } from '@/lib/winston';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { userId, summaryId, title } = body || {};

    if (!userId || !summaryId) {
      return NextResponse.json({ success: false, error: 'Missing userId or summaryId' }, { status: 400 });
    }

    // Check for an existing completion for this summary (idempotent)
    const existing = await Activity.findOne({ user: userId, type: 'summary.read', 'meta.summaryId': String(summaryId) }).lean();
    if (existing) {
      logger.info('Summary already marked read', { userId, summaryId });
      return NextResponse.json({ success: true, message: 'Already marked as read', already: true });
    }

    // Update the summary's isCompleted status
    await Summary.findByIdAndUpdate(summaryId, {
      isCompleted: true,
      isRead: true,
      lastReadAt: new Date()
    });

    // Create activity entry
    await Activity.create({
      user: userId,
      type: 'summary.read',
      action: 'completed',
      meta: {
        summaryId: String(summaryId),
        title: title || null
      },
      progress: 100
    });

    logger.info('Summary marked as read', { userId, summaryId, title });

    // Respond success
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to mark summary read', err);
    return NextResponse.json({ success: false, error: 'Failed to mark summary read' }, { status: 500 });
  }
}
