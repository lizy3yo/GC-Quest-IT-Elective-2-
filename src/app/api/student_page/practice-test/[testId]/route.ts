import { NextRequest, NextResponse } from 'next/server';
import { PracticeTest } from '@/models/practice-test';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';

export const dynamic = 'force-dynamic';

// GET endpoint to retrieve a single practice test by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;

    if (!testId) {
      return NextResponse.json(
        { success: false, error: 'Test ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const practiceTest = await PracticeTest.findById(testId).lean();

    if (!practiceTest) {
      return NextResponse.json(
        { success: false, error: 'Practice test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: practiceTest
    });

  } catch (error: any) {
    const { testId } = await params;
    logger.error('Failed to retrieve practice test:', {
      error: error.message,
      testId
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve practice test'
      },
      { status: 500 }
    );
  }
}
