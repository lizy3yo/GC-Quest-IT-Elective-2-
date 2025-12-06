import { NextRequest, NextResponse } from 'next/server';
import { PracticeTestSubmission } from '@/models/practice-test-submission';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Fetch all submissions for this practice test by this user
    const submissions = await PracticeTestSubmission.find({
      practiceTestId: testId,
      userId: userId
    })
      .sort({ completedAt: -1 })
      .lean();

    // Transform submissions to results format
    const results = submissions.map((sub: any) => ({
      _id: sub._id,
      score: sub.score,
      pointsEarned: sub.pointsEarned,
      totalPoints: sub.totalPoints,
      timeSpent: sub.timeSpent,
      isPerfectScore: sub.isPerfectScore,
      submittedAt: sub.completedAt,
      completedAt: sub.completedAt,
      correctAnswers: sub.answers?.filter((a: any) => a.isCorrect).length || 0,
      incorrectAnswers: sub.answers?.filter((a: any) => !a.isCorrect && a.questionType === 'multiple-choice').length || 0,
      totalQuestions: sub.answers?.length || 0,
      feedback: sub.feedback || null
    }));

    logger.info('Fetched practice test results', {
      testId,
      userId,
      resultsCount: results.length
    });

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error: any) {
    logger.error('Failed to fetch practice test results:', {
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch results'
      },
      { status: 500 }
    );
  }
}
