import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/student_page/class/[classId]/assessment/[assessmentId]/live-session
 * Get live session status for student
 */
export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const authzResult = await authorize(authResult.userId, ['student']);
    if (authzResult !== true) return authzResult as Response;

    await connectToDatabase();

    const params = await context.params;
    const { assessmentId } = params;

    const assessment = await Assessment.findOne({ _id: assessmentId, published: true });
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found or not published' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        liveSession: assessment.liveSession || { isActive: false }
      }
    });

  } catch (error) {
    console.error('Error fetching live session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/student_page/class/[classId]/assessment/[assessmentId]/live-session
 * Join a live session
 */
export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const authzResult = await authorize(authResult.userId, ['student']);
    if (authzResult !== true) return authzResult as Response;

    await connectToDatabase();

    const params = await context.params;
    const { assessmentId } = params;
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    const assessment = await Assessment.findOne({ _id: assessmentId, published: true });
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found or not published' }, { status: 404 });
    }

    // Initialize liveSession if it doesn't exist (for lobby)
    if (!assessment.liveSession) {
      assessment.liveSession = {
        isActive: false,
        studentsJoined: [],
        currentQuestionIndex: 0
      };
    }

    const userIdStr = authResult.userId.toString();

    if (!assessment.liveSession.studentStatus) {
      assessment.liveSession.studentStatus = {};
    }

    if (action === 'leave') {
      // Remove student from lobby
      if (assessment.liveSession.studentsJoined) {
        assessment.liveSession.studentsJoined = assessment.liveSession.studentsJoined.filter(
          (id: string) => id !== userIdStr
        );
        // clear status entry
        delete assessment.liveSession.studentStatus[userIdStr];
        await assessment.save();
        console.log(`👋 Student ${userIdStr} left lobby. Remaining: ${assessment.liveSession.studentsJoined.length}`);
      }

    } else if (action === 'away') {
      // Mark student as away (tab hidden)
      const now = new Date();
      const existing = assessment.liveSession.studentStatus[userIdStr] || {};
      existing.away = true;
      existing.lastAwayAt = now.toISOString();
      existing.tabSwitches = (existing.tabSwitches || 0) + 1;
      assessment.liveSession.studentStatus[userIdStr] = existing;
      await assessment.save();
      console.log(`🔕 Student ${userIdStr} marked away`);

    } else if (action === 'return') {
      // Mark student returned (tab visible) and add duration
      const { duration } = body as any;
      const existing = assessment.liveSession.studentStatus[userIdStr] || {};
      existing.away = false;
      if (existing.totalAwayMs == null) existing.totalAwayMs = 0;
      if (typeof duration === 'number') existing.totalAwayMs = (existing.totalAwayMs || 0) + duration;
      existing.lastAwayAt = null;
      assessment.liveSession.studentStatus[userIdStr] = existing;
      await assessment.save();
      console.log(`🔔 Student ${userIdStr} returned after ${duration}ms`);

    } else if (action === 'reset') {
      // Reset student's answers for a new attempt
      if (assessment.liveSession.studentAnswers) {
        assessment.liveSession.studentAnswers = assessment.liveSession.studentAnswers.filter(
          (a: any) => a.studentId !== userIdStr
        );
      }
      // Reset status
      assessment.liveSession.studentStatus[userIdStr] = { away: false, tabSwitches: 0, totalAwayMs: 0 };
      await assessment.save();
      console.log(`🔄 Student ${userIdStr} reset for new attempt`);

    } else {
      // Default action: join
      if (!assessment.liveSession.studentsJoined) {
        assessment.liveSession.studentsJoined = [];
      }

      if (!assessment.liveSession.studentsJoined.includes(userIdStr)) {
        assessment.liveSession.studentsJoined.push(userIdStr);
      }
      
      // Clear previous answers for this student (fresh start)
      if (assessment.liveSession.studentAnswers) {
        assessment.liveSession.studentAnswers = assessment.liveSession.studentAnswers.filter(
          (a: any) => a.studentId !== userIdStr
        );
      }
      
      // ensure status exists
      assessment.liveSession.studentStatus[userIdStr] = assessment.liveSession.studentStatus[userIdStr] || { away: false, tabSwitches: 0, totalAwayMs: 0 };
      await assessment.save();
      console.log(`✅ Student ${userIdStr} joined lobby (answers cleared). Total: ${assessment.liveSession.studentsJoined.length}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        liveSession: assessment.liveSession || { isActive: false }
      }
    });

  } catch (error) {
    console.error('Error joining live session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
