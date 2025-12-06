import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/teacher_page/assessment/[id]/live-progress
 * Get real-time progress of students in live session
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

    const liveSession = assessment.liveSession;
    
    // Get all students who have submitted for this assessment (they may have left lobby)
    const submissions = await Submission.find({
      assessmentId: id,
      status: { $in: ['submitted', 'graded'] }
    }).lean() as any[];
    
    console.log(`📊 Found ${submissions.length} submissions for assessment ${id}`);
    submissions.forEach((s: any) => {
      console.log(`  - Student ${s.studentId}: score=${s.score}, maxScore=${s.maxScore}, status=${s.status}`);
    });
    
    // Also log live session answers
    const liveAnswers = liveSession?.studentAnswers || [];
    console.log(`📊 Live session has ${liveAnswers.length} answers`);
    liveAnswers.forEach((a: any) => {
      console.log(`  - Student ${a.studentId}, Q: ${a.questionId}, isCorrect: ${a.isCorrect}`);
    });
    
    const submittedStudentIds = submissions.map((s: any) => s.studentId.toString());
    
    // Combine students in lobby + students who submitted
    const allStudentIds = [...new Set([
      ...(liveSession?.studentsJoined || []),
      ...submittedStudentIds
    ])];
    
    if (allStudentIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { students: [] }
      });
    }

    // Get progress for each student
    const studentProgress = await Promise.all(
      allStudentIds.map(async (studentId: string) => {
        // Count answers from liveSession.studentAnswers
        const studentAnswers = (liveSession?.studentAnswers || []).filter(
          (a: any) => a.studentId === studentId
        );
        
        const answeredCount = studentAnswers.length;
        
        // Calculate score from correct answers
        let score = 0;
        studentAnswers.forEach((answer: any) => {
          const question = assessment.questions.find((q: any) => 
            q._id?.toString() === answer.questionId || 
            q._id === answer.questionId ||
            q.id === answer.questionId
          );
          if (question && answer.isCorrect) {
            score += question.points || 1;
          }
        });
        
        // Get ALL submissions for this student to find highest score
        const studentSubmissions = submissions.filter((s: any) => 
          s.studentId?.toString() === studentId || s.studentId === studentId
        );
        
        // Find the highest score from all attempts
        let highestScore = 0;
        studentSubmissions.forEach((sub: any) => {
          let subScore = sub.score ?? 0;
          // Also check gradedAnswers for accuracy
          if (sub.gradedAnswers && Array.isArray(sub.gradedAnswers)) {
            const recalculated = sub.gradedAnswers.reduce((sum: number, ga: any) => sum + (ga.points || 0), 0);
            if (recalculated > subScore) subScore = recalculated;
          }
          if (subScore > highestScore) highestScore = subScore;
        });

        // Check if student is currently in the lobby (taking/retaking exam)
        const isInLobby = (liveSession?.studentsJoined || []).includes(studentId);
        
        // Student is "in progress" if they're in lobby and have answered some questions but not all
        // Student is "complete" only if they have submitted AND are NOT currently in lobby (retaking)
        const hasSubmitted = studentSubmissions.length > 0;
        const isCurrentlyTaking = isInLobby && answeredCount < assessment.questions.length;
        const isComplete = hasSubmitted && !isInLobby;
        
        // Current question: if in lobby, show live progress; if completed, show total
        const currentQuestion = isInLobby ? answeredCount : (hasSubmitted ? assessment.questions.length : 0);
        
        // Use highest submission score, or live score if currently taking
        const finalScore = highestScore > 0 ? highestScore : score;
        
        console.log(`📊 Student ${studentId}: inLobby=${isInLobby}, attempts=${studentSubmissions.length}, answeredCount=${answeredCount}, isComplete=${isComplete}, highestScore=${highestScore}, liveScore=${score}, finalScore=${finalScore}`);

        return {
          studentId,
          currentQuestion,
          isComplete,
          isInProgress: isCurrentlyTaking,
          answeredCount,
          score: finalScore,
          attempts: studentSubmissions.length
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        students: studentProgress
      }
    });

  } catch (error) {
    console.error('Error fetching live progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
