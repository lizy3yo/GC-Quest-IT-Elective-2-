import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';
import User from '@/models/user';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/teacher_page/assessment/[id]/student/[studentId]/submission
 * Get detailed submission for a specific student and assessment
 */
export async function GET(
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

    // Verify the assessment belongs to this teacher
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      teacherId: authResult.userId.toString()
    }).lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Get student details
    const student = await User.findOne({
      _id: studentId,
      role: 'student'
    }).select('_id firstName lastName email').lean() as any;

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Get the student's submission
    const submission = await Submission.findOne({
      assessmentId: assessmentId,
      studentId: studentId
    }).sort({ submittedAt: -1 }).lean() as any; // Get the latest submission

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Format the response
    const formattedSubmission = {
      id: submission._id.toString(),
      studentId: submission.studentId,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      studentEmail: student.email,
      score: submission.score || 0,
      maxScore: submission.maxScore || 100,
      status: submission.status,
      submittedAt: submission.submittedAt,
      timeSpent: submission.timeSpent,
      attemptNumber: submission.attemptNumber,
      needsManualGrading: submission.needsManualGrading || false,
      gradedAt: submission.gradedAt,
      gradedBy: submission.gradedBy,
      feedback: submission.feedback,
      gradedAnswers: submission.gradedAnswers || []
    };

    const formattedAssessment = {
      id: assessment._id.toString(),
      title: assessment.title,
      totalPoints: assessment.totalPoints,
      dueDate: assessment.dueDate,
      questions: assessment.questions || []
    };

    return NextResponse.json({
      success: true,
      data: {
        assessment: formattedAssessment,
        submission: formattedSubmission
      }
    });

  } catch (error) {
    console.error('Error fetching student submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}