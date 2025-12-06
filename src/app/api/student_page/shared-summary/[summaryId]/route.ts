import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';
import User from '@/models/user';
import { Summary } from '@/models/summary';

export const GET = async (request: NextRequest, context: { params: any }) => {
  const { summaryId } = await context.params;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'User ID is required and must be valid',
        },
        { status: 400 }
      );
    }

    if (!summaryId || !Types.ObjectId.isValid(summaryId)) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Summary ID is required and must be valid',
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findById(userId).lean();
    if (!user) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'User not found' },
        { status: 404 }
      );
    }

    // For shared summaries, allow access if:
    // - The requesting user is the owner (userId matches), or
    // - The summary is public (published by teacher or made public)
    const summary = await Summary.findOne({
      _id: summaryId,
      $or: [
        { userId: userId },
        { isPublic: true },
      ],
    }).lean();

    if (!summary) {
      return NextResponse.json(
        {
          code: 'NOT_FOUND',
          message: 'Summary not found or you do not have access',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ summary }, { status: 200 });
  } catch (err: any) {
    try { logger?.error?.('GET /shared-summary error', { err }); } catch {}
    return NextResponse.json(
      { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
};
