import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/student_page/class/[classId]/assessment/[assessmentId]/results
 * Get assessment results for student view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; assessmentId: string }> }
) {
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult; // Return authentication error response
    }

    // Authorize student role
    const authzResult = await authorize(authResult.userId, ['student']);
    if (authzResult !== true) {
      return authzResult as Response; // Return authorization error response
    }

    await connectToDatabase();

    const { classId, assessmentId } = await params;

    console.log('Student results request:', { classId, assessmentId, userId: authResult.userId });

    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json({
        error: 'Invalid assessment ID format',
        debug: { assessmentId, isValid: false }
      }, { status: 400 });
    }

    // Find the assessment
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      classId: classId,
      published: true
    }).lean() as any;

    if (!assessment) {
      return NextResponse.json({
        error: 'Assessment not found or not available'
      }, { status: 404 });
    }

    // Get all submissions for this student and assessment
    const submissions = await Submission.find({
      assessmentId: assessmentId,
      studentId: authResult.userId.toString(),
      status: { $in: ['submitted', 'graded', 'late'] }
    }).sort({ submittedAt: -1 }).lean() as any[];

    console.log('Found submissions:', submissions.length);
    if (submissions.length > 0) {
      console.log('First submission details:', {
        id: submissions[0]._id,
        score: submissions[0].score,
        maxScore: submissions[0].maxScore,
        status: submissions[0].status,
        needsManualGrading: submissions[0].needsManualGrading,
        hasGradedAnswers: !!(submissions[0].gradedAnswers && submissions[0].gradedAnswers.length > 0),
        gradedAnswersCount: submissions[0].gradedAnswers?.length || 0,
        hasAnswers: !!(submissions[0].answers && submissions[0].answers.length > 0),
        answersCount: submissions[0].answers?.length || 0,
        gradedAt: submissions[0].gradedAt
      });
      
      // Log details about graded answers
      if (submissions[0].gradedAnswers && submissions[0].gradedAnswers.length > 0) {
        console.log('Graded answers breakdown:');
        submissions[0].gradedAnswers.forEach((ga: any, index: number) => {
          console.log(`  Answer ${index + 1}:`, {
            questionId: ga.questionId,
            isCorrect: ga.isCorrect,
            points: ga.points,
            maxPoints: ga.maxPoints,
            needsManualGrading: ga.needsManualGrading,
            hasCorrectAnswer: !!ga.correctAnswer
          });
        });
      }
    }

    if (submissions.length === 0) {
      return NextResponse.json({
        error: 'No submissions found for this assessment'
      }, { status: 404 });
    }

    // Process submissions for response
    const processedSubmissions = submissions.map((submission: any, index: number) => {
      // Calculate score percentage
      const scorePercentage = submission.maxScore > 0 
        ? (submission.score / submission.maxScore) * 100 
        : submission.score || 0;

      // Process graded answers - prioritize gradedAnswers, fallback to original answers
      let gradedAnswers = [];
      
      if (submission.gradedAnswers && submission.gradedAnswers.length > 0) {
        // Use existing graded answers
        gradedAnswers = submission.gradedAnswers.map((answer: any) => ({
          questionId: answer.questionId,
          studentAnswer: answer.studentAnswer,
          correctAnswer: answer.needsManualGrading && !answer.isManuallyGraded 
            ? null // Hide correct answer for manual grading questions that haven't been graded
            : answer.correctAnswer,
          isCorrect: answer.isCorrect,
          points: answer.points || 0,
          maxPoints: answer.maxPoints || 0,
          needsManualGrading: answer.needsManualGrading || false,
          isManuallyGraded: answer.isManuallyGraded || false,
          feedback: answer.feedback || ''
        }));
        console.log('Using graded answers:', gradedAnswers.length);
      } else if (submission.answers && submission.answers.length > 0) {
        // Create graded answers from original answers for display
        gradedAnswers = submission.answers.map((answer: any) => ({
          questionId: answer.questionId,
          studentAnswer: answer.answer,
          correctAnswer: null,
          isCorrect: false,
          points: 0,
          maxPoints: 1,
          needsManualGrading: true
        }));
        console.log('Created graded answers from original answers:', gradedAnswers.length);
      } else {
        console.log('No answers found in submission');
      }

      return {
        id: submission._id.toString(),
        score: scorePercentage,
        maxScore: 100,
        status: submission.status,
        submittedAt: submission.submittedAt,
        timeSpent: submission.timeSpent,
        attemptNumber: submissions.length - index, // Most recent is attempt 1, oldest is highest number
        needsManualGrading: submission.needsManualGrading || false,
        gradedAt: submission.gradedAt,
        feedback: submission.feedback,
        gradedAnswers: gradedAnswers || []
      };
    });

    // Assessment info for results page (include full question details for review)
    const assessmentInfo = {
      id: assessment._id.toString(),
      title: assessment.title,
      totalPoints: assessment.totalPoints,
      dueDate: assessment.dueDate,
      questions: assessment.questions.map((q: any) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        description: q.description,
        options: q.options,
        points: q.points,
        items: q.items, // For enumeration questions
        pairs: q.pairs, // For matching questions
        src: q.src, // For image questions
        alt: q.alt, // For image questions
        required: q.required
      }))
    };

    return NextResponse.json({
      success: true,
      data: {
        assessment: assessmentInfo,
        submissions: processedSubmissions
      }
    });

  } catch (error) {
    console.error('Error fetching assessment results:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}