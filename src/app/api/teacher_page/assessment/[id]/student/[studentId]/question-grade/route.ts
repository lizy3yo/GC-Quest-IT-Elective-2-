import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Submission from '@/models/submission';
import Assessment from '@/models/assessment';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * PUT /api/teacher_page/assessment/[id]/student/[studentId]/question-grade
 * Grade an individual question for a student's submission
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult; // Return authentication error response
    }

    // Authorize teacher role
    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) {
      return authzResult as Response; // Return authorization error response
    }

    await connectToDatabase();

    const { id: assessmentId, studentId } = await params;
    const body = await request.json();
    const { questionId, points, feedback } = body;

    console.log('Manual grading request:', {
      assessmentId,
      studentId,
      questionId,
      points,
      feedback: feedback ? 'provided' : 'none'
    });

    // Validate required fields
    if (!questionId || points === undefined || points === null) {
      return NextResponse.json(
        { error: 'Missing required fields: questionId and points' },
        { status: 400 }
      );
    }

    // Verify the assessment exists and teacher owns it
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      teacherId: authResult.userId.toString()
    }).lean();

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Find the question in the assessment to get max points
    const question = (assessment as any).questions.find((q: any) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const maxPoints = question.points || 1;

    // Validate points
    if (points < 0 || points > maxPoints) {
      return NextResponse.json(
        { error: `Points must be between 0 and ${maxPoints}` },
        { status: 400 }
      );
    }

    // Find the student's submission
    const submission = await Submission.findOne({
      assessmentId: assessmentId,
      studentId: studentId
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Update the graded answer for this question
    const gradedAnswerIndex = submission.gradedAnswers.findIndex(
      (ga: any) => ga.questionId === questionId
    );

    if (gradedAnswerIndex === -1) {
      return NextResponse.json({ error: 'Question answer not found' }, { status: 404 });
    }

    // Update the graded answer
    submission.gradedAnswers[gradedAnswerIndex].points = points;
    submission.gradedAnswers[gradedAnswerIndex].isCorrect = points === maxPoints;
    submission.gradedAnswers[gradedAnswerIndex].isManuallyGraded = true;

    // Add question feedback if provided
    if (feedback && feedback.trim()) {
      submission.gradedAnswers[gradedAnswerIndex].feedback = feedback.trim();
    }

    // Recalculate total score
    const totalPoints = submission.gradedAnswers.reduce((sum: number, ga: any) => sum + ga.points, 0);
    const totalMaxPoints = submission.gradedAnswers.reduce((sum: number, ga: any) => sum + ga.maxPoints, 0);
    const newPercentageScore = totalMaxPoints > 0 ? (totalPoints / totalMaxPoints) * 100 : 0;

    submission.score = Math.round(newPercentageScore * 100) / 100;

    // Check if all manual grading questions have been graded
    const needsManualGrading = submission.gradedAnswers.some(
      (ga: any) => ga.needsManualGrading && !ga.isManuallyGraded
    );
    submission.needsManualGrading = needsManualGrading;

    // Update status if all manual grading is complete
    if (!needsManualGrading && submission.status === 'submitted') {
      submission.status = 'graded';
      submission.gradedAt = new Date();
    }

    await submission.save();

    console.log('Question graded successfully:', {
      questionId,
      points,
      maxPoints,
      newTotalScore: submission.score,
      needsManualGrading: submission.needsManualGrading
    });

    return NextResponse.json({
      success: true,
      data: {
        questionId,
        points,
        maxPoints,
        totalScore: submission.score,
        needsManualGrading: submission.needsManualGrading,
        status: submission.status
      }
    });

  } catch (error) {
    console.error('Error grading question:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.message },
          { status: 400 }
        );
      }
      
      // Handle cast errors (invalid ObjectId, etc.)
      if (error.name === 'CastError') {
        return NextResponse.json(
          { error: 'Invalid data format', details: error.message },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}