import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import User from '@/models/user';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * POST /api/teacher_page/assessment/[id]/live-session
 * Start or update a live session
 */
export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) return authzResult as Response;

    await connectToDatabase();

    const params = await context.params;
    const { id } = params;
    const body = await request.json();
    const { action, sessionCode, currentQuestionIndex } = body;

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    if (assessment.teacherId !== authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'start') {
      // Start live session - clear previous students for fresh start
      assessment.liveSession = {
        isActive: true,
        sessionCode: sessionCode || Math.floor(100000 + Math.random() * 900000).toString(),
        startedAt: new Date(),
        startedBy: authResult.userId,
        currentQuestionIndex: 0,
        studentsJoined: assessment.liveSession?.studentsJoined || [] // Keep students who already joined lobby
      };
      // Unlock the assessment so students can access it
      assessment.isLocked = false;
      console.log(`🎬 Starting live session with ${assessment.liveSession.studentsJoined.length} students in lobby (assessment unlocked)`);
    } else if (action === 'update') {
      // Update session (e.g., move to next question)
      if (assessment.liveSession) {
        assessment.liveSession.currentQuestionIndex = currentQuestionIndex ?? assessment.liveSession.currentQuestionIndex;
      }
    } else if (action === 'end') {
      // End live session and clear students for next session
      if (assessment.liveSession) {
        assessment.liveSession.isActive = false;
        assessment.liveSession.studentsJoined = []; // Clear students when ending
        console.log('🛑 Ending live session and clearing student list');
      }
    } else if (action === 'reset') {
      // Reset session completely (for starting fresh)
      assessment.liveSession = {
        isActive: false,
        studentsJoined: [],
        currentQuestionIndex: 0
      };
      console.log('🔄 Resetting live session');
    }

    await assessment.save();

    return NextResponse.json({
      success: true,
      data: {
        liveSession: assessment.liveSession
      }
    });

  } catch (error) {
    console.error('Error managing live session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/teacher_page/assessment/[id]/live-session
 * Get live session status
 */
export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) return authzResult as Response;

    await connectToDatabase();

    const params = await context.params;
    const { id } = params;

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    if (assessment.teacherId !== authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Include student answers and calculate stats
    const liveSession = assessment.liveSession || { isActive: false };
    
    // Get all students who have submitted (they may have left lobby)
    const Submission = (await import('@/models/submission')).default;
    const submissions = await Submission.find({
      assessmentId: id,
      status: { $in: ['submitted', 'graded'] }
    }).lean() as any[];
    
    const submittedStudentIds = submissions.map((s: any) => s.studentId.toString());
    
    // Combine students in lobby + students who submitted
    const allStudentIds = [...new Set([
      ...(liveSession.studentsJoined || []),
      ...submittedStudentIds
    ])];
    
    // Fetch student details (name and email)
    const studentDetails = await User.find(
      { _id: { $in: allStudentIds } },
      { firstName: 1, lastName: 1, email: 1 }
    );
    
    const studentDetailsMap = new Map(
      studentDetails.map((student: any) => [
        student._id.toString(),
        {
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email
        }
      ])
    );
    
    // Create a map of submissions by studentId for quick lookup
    const submissionMap = new Map(
      submissions.map((s: any) => [s.studentId.toString(), s])
    );
    
    const studentStats = allStudentIds.map((studentId: string) => {
      const studentAnswers = liveSession.studentAnswers?.filter((a: any) => a.studentId === studentId) || [];
      const correctCount = studentAnswers.filter((a: any) => a.isCorrect).length;
      const totalAnswered = studentAnswers.length;
      const details = studentDetailsMap.get(studentId) as any;
      const submission = submissionMap.get(studentId) as any;
      const status = liveSession.studentStatus?.[studentId] || {};
      
      // Get tab switching data from both live status and submission
      const liveTabSwitches = status.tabSwitches || 0;
      const liveTotalAwayMs = status.totalAwayMs || 0;
      const submissionTabSwitches = submission?.tabSwitches || 0;
      const submissionTotalAwayMs = submission?.totalAwayMs || 0;
      
      return {
        studentId,
        firstName: details?.firstName || 'Unknown',
        lastName: details?.lastName || 'Student',
        email: details?.email || '',
        answeredCount: submission ? assessment.questions.length : totalAnswered,
        correctCount,
        currentQuestion: submission ? assessment.questions.length : totalAnswered,
        answers: studentAnswers,
        hasSubmitted: !!submission,
        score: submission?.score ?? 0,
        // Include tab switching data - use submission data if available, otherwise live status
        tabSwitches: submission ? submissionTabSwitches : liveTabSwitches,
        totalAwayMs: submission ? submissionTotalAwayMs : liveTotalAwayMs,
        away: status.away || false
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        liveSession,
        studentStats
      }
    });

  } catch (error) {
    console.error('Error fetching live session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
