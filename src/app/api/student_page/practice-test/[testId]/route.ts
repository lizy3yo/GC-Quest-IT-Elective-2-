import { NextRequest, NextResponse } from 'next/server';
import { PracticeTest } from '@/models/practice-test';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';

export const dynamic = 'force-dynamic';

// GET endpoint to retrieve a single practice test by ID
export async function GET(req: NextRequest, context: any) {
  const params = await context.params;
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

// PATCH endpoint to update fields on a practice test (rename, favorite, folder, etc.)
export async function PATCH(req: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { testId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!testId) {
      return NextResponse.json({ success: false, error: 'Test ID is required' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    await connectToDatabase();

    const test = await PracticeTest.findById(testId);
    if (!test) {
      return NextResponse.json({ success: false, error: 'Practice test not found' }, { status: 404 });
    }

    // Verify ownership
    if (String(test.userId) !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Check if full practiceTest object is being sent (from question editor)
    if (body.practiceTest) {
      const pt = body.practiceTest;
      // Update all editable fields from the practiceTest object
      if (pt.title !== undefined) test.title = pt.title;
      if (pt.description !== undefined) test.description = pt.description;
      if (pt.timeLimit !== undefined) test.timeLimit = pt.timeLimit;
      if (pt.totalPoints !== undefined) test.totalPoints = pt.totalPoints;
      if (pt.subject !== undefined) test.subject = pt.subject;
      if (pt.topics !== undefined) test.topics = pt.topics;
      if (pt.multipleChoiceQuestions !== undefined) test.multipleChoiceQuestions = pt.multipleChoiceQuestions;
      if (pt.writtenQuestions !== undefined) test.writtenQuestions = pt.writtenQuestions;
      
      // Recalculate total points
      const mcPoints = (pt.multipleChoiceQuestions || []).reduce((s: number, q: any) => s + (q.points || 0), 0);
      const wPoints = (pt.writtenQuestions || []).reduce((s: number, q: any) => s + (q.points || 0), 0);
      test.totalPoints = mcPoints + wPoints;
      
      await test.save();
      return NextResponse.json({ success: true, practiceTest: test });
    }

    // Apply allowed updates (for simple field updates)
    const allowed = ['title', 'isFavorite', 'folder', 'timeLimit', 'totalPoints', 'description', 'subject', 'isRead'];
    let changed = false;
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        // @ts-ignore
        test[key] = body[key];
        changed = true;
        
        // If isFavorite is being updated, also update favoritedAt
        if (key === 'isFavorite') {
          test.favoritedAt = body[key] ? new Date() : undefined;
        }
        
        // If isRead is being updated, also update lastReadAt
        if (key === 'isRead') {
          test.lastReadAt = body[key] ? new Date() : undefined;
        }
      }
    }

    if (changed) {
      await test.save();
      return NextResponse.json({ success: true, practiceTest: test });
    }

    // Nothing to change
    return NextResponse.json({ success: true, practiceTest: test });
  } catch (error: any) {
    const { testId } = await params;
    logger.error('Failed to PATCH practice test:', { error: error.message, testId });
    return NextResponse.json({ success: false, error: 'Failed to update practice test' }, { status: 500 });
  }
}

// DELETE endpoint to remove a practice test
export async function DELETE(req: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { testId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!testId) {
      return NextResponse.json({ success: false, error: 'Test ID is required' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
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
    const { testId } = await params;
    logger.error('Failed to delete practice test:', { error: error.message, testId });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete practice test'
      },
      { status: 500 }
    );
  }
}
