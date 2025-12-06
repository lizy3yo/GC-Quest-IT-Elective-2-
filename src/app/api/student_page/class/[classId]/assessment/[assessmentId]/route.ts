import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment, { IAssessment } from '@/models/assessment';
import Submission from '@/models/submission';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/student_page/class/[classId]/assessment/[assessmentId]
 * Get assessment details for student view
 */
export async function GET(
  request: NextRequest,
  context: any
) {
  const params = await context.params;
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
    }).lean() as (IAssessment & { _id: any }) | null;

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

    // Evaluate scheduled open/close and manual lock state.
    // Use dueDate as a fallback for scheduledClose if provided.
    const scheduledOpen = assessment.scheduledOpen ? new Date(assessment.scheduledOpen) : null;
    const scheduledClose = assessment.scheduledClose
      ? new Date(assessment.scheduledClose)
      : (assessment.dueDate ? new Date(assessment.dueDate) : null);

    const isManuallyLocked = !!assessment.isLocked;
    // Check if live session is active - if so, always allow access
    const isLiveSessionActive = assessment.liveSession?.isActive === true;
    let isUnlocked = false;

    // If live session is active, always unlock for students
    if (isLiveSessionActive) {
      isUnlocked = true;
    } else if (!isManuallyLocked) {
      // If not manually locked, consider scheduled times
      if (scheduledOpen && now < scheduledOpen) {
        isUnlocked = false;
      } else if (scheduledClose && now >= scheduledClose) {
        isUnlocked = false;
      } else {
        isUnlocked = true;
      }
    } else {
      // Manually locked: only unlocked if scheduledOpen passed (if provided) and scheduledClose not passed
      if (scheduledOpen && now >= scheduledOpen) {
        if (scheduledClose && now >= scheduledClose) {
          isUnlocked = false;
        } else {
          isUnlocked = true;
        }
      } else {
        isUnlocked = false;
      }
    }

    if (!isUnlocked) {
      // Provide helpful debug info to the client so the UI can show when it will open/close
      return NextResponse.json({
        error: 'Assessment is currently locked',
        data: {
          locked: true,
          scheduledOpen: scheduledOpen ? scheduledOpen.toISOString() : null,
          scheduledClose: scheduledClose ? scheduledClose.toISOString() : null,
          dueDate: assessment.dueDate ? new Date(assessment.dueDate).toISOString() : null
        }
      }, { status: 403 });
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
      dueDate: assessment.dueDate,
      isLocked: !!assessment.isLocked,
      scheduledOpen: assessment.scheduledOpen || null,
      scheduledClose: assessment.scheduledClose || assessment.dueDate || null,
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