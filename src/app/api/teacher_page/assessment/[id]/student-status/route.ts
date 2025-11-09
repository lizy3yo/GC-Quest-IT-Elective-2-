import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';
import User from '@/models/user';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/teacher_page/assessment/[id]/student-status
 * Get all student submissions and status for a specific assessment
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: assessmentId } = await params;

    // Verify the assessment belongs to this teacher
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      teacherId: authResult.userId.toString()
    }).lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Get all submissions for this assessment
    const submissions = await Submission.find({
      assessmentId: assessmentId
    }).sort({ submittedAt: -1 }).lean();

    // Get student details for each submission
    const studentIds = [...new Set(submissions.map(sub => sub.studentId))];
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student'
    }).select('_id firstName lastName email').lean();

    // Create a map of student info
    const studentMap = new Map();
    students.forEach((student: any) => {
      studentMap.set(student._id.toString(), {
        studentId: student._id.toString(),
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email
      });
    });

    // Format submissions with student info
    const formattedSubmissions = submissions.map((submission: any) => {
      const studentInfo = studentMap.get(submission.studentId) || {
        studentId: submission.studentId,
        firstName: 'Unknown',
        lastName: 'Student',
        email: 'unknown@example.com'
      };

      return {
        id: submission._id.toString(),
        studentId: submission.studentId,
        studentName: `${studentInfo.firstName} ${studentInfo.lastName}`.trim(),
        studentEmail: studentInfo.email,
        score: submission.score,
        maxScore: submission.maxScore || 100,
        status: submission.status,
        submittedAt: submission.submittedAt,
        timeSpent: submission.timeSpent,
        attemptNumber: submission.attemptNumber,
        needsManualGrading: submission.needsManualGrading,
        gradedAt: submission.gradedAt,
        gradedBy: submission.gradedBy
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        assessment: {
          id: assessment._id.toString(),
          title: assessment.title,
          totalPoints: assessment.totalPoints,
          dueDate: assessment.dueDate
        },
        submissions: formattedSubmissions
      }
    });

  } catch (error) {
    console.error('Error fetching student status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teacher_page/assessment/[id]/student-status
 * Update student score for an assessment
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: assessmentId } = await params;
    const { studentId, score, feedback } = await request.json();

    // Verify the assessment belongs to this teacher
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      teacherId: authResult.userId.toString()
    }).lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Validate score
    if (typeof score !== 'number' || score < 0 || score > 100) {
      return NextResponse.json({ error: 'Invalid score. Must be between 0 and 100.' }, { status: 400 });
    }

    // Find the student's submission
    const submission = await Submission.findOne({
      assessmentId: assessmentId,
      studentId: studentId
    }).sort({ submittedAt: -1 }); // Get the latest submission

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Update the submission with the new score
    submission.score = score;
    submission.feedback = feedback || submission.feedback;
    submission.status = 'graded';
    submission.gradedAt = new Date();
    submission.gradedBy = authResult.userId.toString();
    submission.needsManualGrading = false;

    await submission.save();

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission._id.toString(),
        score: submission.score,
        status: submission.status,
        gradedAt: submission.gradedAt
      }
    });

  } catch (error) {
    console.error('Error updating student score:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}