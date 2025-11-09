import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/student_page/class/[classId]/assessment/[assessmentId]
 * Get assessment details for student view
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

    console.log('Student assessment request:', { classId, assessmentId, userId: authResult.userId });

    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      return NextResponse.json({
        error: 'Invalid assessment ID format',
        debug: { assessmentId, isValid: false }
      }, { status: 400 });
    }

    // Find the assessment with debugging
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      classId: classId,
      published: true // Only show published assessments to students
    }).lean() as any;

    console.log('Assessment found:', !!assessment);

    if (!assessment) {
      // Debug: Check if assessment exists without published filter
      const anyAssessment = await Assessment.findOne({ _id: assessmentId }).lean() as any;
      console.log('Assessment exists (any):', !!anyAssessment);
      if (anyAssessment) {
        console.log('Assessment details:', {
          id: anyAssessment._id,
          classId: anyAssessment.classId,
          published: anyAssessment.published,
          teacherId: anyAssessment.teacherId
        });

        // Provide specific error messages
        if (anyAssessment.classId !== classId) {
          return NextResponse.json({
            error: 'Assessment belongs to a different class',
            debug: { expectedClassId: classId, actualClassId: anyAssessment.classId }
          }, { status: 404 });
        }

        if (!anyAssessment.published) {
          return NextResponse.json({
            error: 'Assessment is not yet published by the teacher',
            debug: { published: false, message: 'Please wait for your teacher to publish this assessment' }
          }, { status: 403 });
        }
      }

      return NextResponse.json({
        error: 'Assessment not found or not available',
        debug: {
          searchedFor: { assessmentId, classId, published: true },
          assessmentExists: !!anyAssessment,
          assessmentClassId: anyAssessment?.classId,
          assessmentPublished: anyAssessment?.published
        }
      }, { status: 404 });
    }

    // Check if assessment is available (time-based availability)
    const now = new Date();
    if (assessment.availableFrom && now < assessment.availableFrom) {
      return NextResponse.json({ error: 'Assessment is not yet available' }, { status: 403 });
    }
    if (assessment.availableUntil && now > assessment.availableUntil) {
      return NextResponse.json({ error: 'Assessment is no longer available' }, { status: 403 });
    }

    // Check if student has already submitted (if maxAttempts is 1)
    // Note: We allow access to view results even after submission
    const existingSubmissions = await Submission.find({
      assessmentId: assessmentId,
      studentId: authResult.userId.toString(),
      status: { $in: ['submitted', 'graded', 'late'] }
    }).lean();

    const hasSubmitted = existingSubmissions.length > 0;
    const canRetake = !assessment.maxAttempts || existingSubmissions.length < assessment.maxAttempts;

    // If student has submitted and cannot retake, we still allow access to view results
    // The frontend will handle showing results vs. allowing retake

    // Remove correct answers from questions before sending to student
    const sanitizedQuestions = assessment.questions.map((question: any) => {
      const { answer, ...questionWithoutAnswer } = question;
      return questionWithoutAnswer;
    });

    const studentAssessment = {
      id: assessment._id.toString(),
      title: assessment.title,
      description: assessment.description,
      type: assessment.type,
      category: assessment.category,
      format: assessment.format,
      questions: sanitizedQuestions,
      timeLimitMins: assessment.timeLimitMins,
      maxAttempts: assessment.maxAttempts,
      published: assessment.published,
      accessCode: assessment.accessCode,
      dueDate: assessment.dueDate,
      instructions: assessment.instructions,
      totalPoints: assessment.totalPoints,
      settings: assessment.settings
    };

    return NextResponse.json({
      success: true,
      data: {
        assessment: studentAssessment,
        submissionStatus: {
          hasSubmitted: hasSubmitted,
          canRetake: canRetake,
          submissionCount: existingSubmissions.length,
          latestSubmission: existingSubmissions.length > 0 ? {
            id: (existingSubmissions[existingSubmissions.length - 1] as any)._id.toString(),
            submittedAt: (existingSubmissions[existingSubmissions.length - 1] as any).submittedAt,
            score: (existingSubmissions[existingSubmissions.length - 1] as any).score,
            status: (existingSubmissions[existingSubmissions.length - 1] as any).status
          } : null
        }
      }
    });

  } catch (error) {
    console.error('Error fetching assessment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}