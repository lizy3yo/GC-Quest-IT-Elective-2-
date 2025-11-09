import { NextRequest, NextResponse } from 'next/server';
import { PracticeTest } from '@/models/practice-test';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      practiceTest,
      sourceType,
      sourceIds,
      isPublic // Add isPublic to the destructured fields
    } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!practiceTest) {
      return NextResponse.json(
        { success: false, error: 'Practice test data is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Create new practice test document
    const newPracticeTest = new PracticeTest({
      userId,
      title: practiceTest.title,
      description: practiceTest.description || '',
      subject: practiceTest.subject,
      difficulty: practiceTest.difficulty || 'medium',
      timeLimit: practiceTest.timeLimit || 30,
      totalPoints: practiceTest.totalPoints,
      multipleChoiceQuestions: practiceTest.multipleChoiceQuestions || [],
      writtenQuestions: practiceTest.writtenQuestions || [],
      topics: practiceTest.topics || [],
      learningObjectives: practiceTest.learningObjectives || [],
      instructions: practiceTest.instructions || 'Answer all questions to the best of your ability.',
      sourceType: sourceType || 'paste',
      sourceIds: sourceIds || [],
      isPublic: isPublic || false, // Use the provided isPublic value, default to false
      attempts: 0
    });

    await newPracticeTest.save();

    logger.info('Practice test saved to library', {
      userId,
      testId: newPracticeTest._id,
      title: newPracticeTest.title,
      questionCount: (newPracticeTest.multipleChoiceQuestions?.length || 0) + (newPracticeTest.writtenQuestions?.length || 0)
    });

    return NextResponse.json({
      success: true,
      practiceTest: {
        _id: newPracticeTest._id,
        title: newPracticeTest.title,
        subject: newPracticeTest.subject,
        createdAt: newPracticeTest.createdAt
      },
      message: 'Practice test saved to your library successfully!'
    });

  } catch (error: any) {
    logger.error('Failed to save practice test:', {
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save practice test. Please try again.'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve saved practice tests
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const isPublicParam = searchParams.get('isPublic');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Build query filter
    const query: any = { userId };
    
    // If isPublic parameter is provided, filter by it
    if (isPublicParam !== null) {
      query.isPublic = isPublicParam === 'true';
    }

    const practiceTests = await PracticeTest.find(query)
      .sort({ createdAt: -1 })
      .select('title description subject difficulty timeLimit totalPoints topics attempts averageScore isPublic createdAt updatedAt')
      .lean();

    return NextResponse.json({
      success: true,
      practiceTests
    });

  } catch (error: any) {
    logger.error('Failed to retrieve practice tests:', {
      error: error.message
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve practice tests'
      },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove a practice test
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const testId = searchParams.get('testId');
    const userId = searchParams.get('userId');

    if (!testId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Test ID and User ID are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find and verify ownership before deleting
    const test = await PracticeTest.findOne({ _id: testId, userId });

    if (!test) {
      return NextResponse.json(
        { success: false, error: 'Practice test not found or unauthorized' },
        { status: 404 }
      );
    }

    await PracticeTest.deleteOne({ _id: testId, userId });

    logger.info('Practice test deleted', {
      userId,
      testId,
      title: test.title
    });

    return NextResponse.json({
      success: true,
      message: 'Practice test deleted successfully'
    });

  } catch (error: any) {
    logger.error('Failed to delete practice test:', {
      error: error.message
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete practice test'
      },
      { status: 500 }
    );
  }
}
