import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * POST /api/student_page/class/[classId]/assessment/[assessmentId]/live-answer
 * Submit an answer during live session
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
    const body = await request.json();
    const { questionId, answer, timeSpent } = body;

    const assessment = await Assessment.findOne({ _id: assessmentId, published: true });
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found or not published' }, { status: 404 });
    }

    if (!assessment.liveSession || !assessment.liveSession.isActive) {
      return NextResponse.json({ error: 'Live session is not active' }, { status: 400 });
    }

    // Find the question to check correct answer
    const question = assessment.questions.find((q: any) => q.id === questionId);
    let isCorrect = false;
    
    if (question) {
      const correctAnswer = question.correctAnswer || question.answer;
      
      if (question.type === 'true-false') {
        // Handle true/false - case-insensitive string comparison
        const tfCorrect = (correctAnswer ?? '').toString().toLowerCase().trim();
        const tfStudent = (answer ?? '').toString().toLowerCase().trim();
        isCorrect = tfStudent === tfCorrect;
      } else if (question.type === 'identification') {
        // Case-insensitive comparison for identification
        isCorrect = answer?.toString().trim().toLowerCase() === correctAnswer?.toString().trim().toLowerCase();
      } else if (Array.isArray(correctAnswer)) {
        // For checkbox questions
        const studentArr = Array.isArray(answer) ? answer : [];
        isCorrect = JSON.stringify(studentArr.sort()) === JSON.stringify(correctAnswer.sort());
      } else if (question.type === 'mcq') {
        // Handle MCQ - may need to convert option ID to text
        let studentAnswerText = answer;
        if (typeof studentAnswerText === 'string' && studentAnswerText.startsWith('opt-')) {
          const optionIndex = parseInt(studentAnswerText.split('-')[1]);
          if (!isNaN(optionIndex) && question.options && question.options[optionIndex]) {
            studentAnswerText = question.options[optionIndex];
          }
        }
        if (typeof correctAnswer === 'number') {
          const correctOptionText = question.options && question.options[correctAnswer];
          isCorrect = studentAnswerText === correctOptionText;
        } else {
          isCorrect = studentAnswerText === correctAnswer;
        }
      } else {
        isCorrect = answer === correctAnswer;
      }
    }

    // Initialize studentAnswers if it doesn't exist
    if (!assessment.liveSession.studentAnswers) {
      assessment.liveSession.studentAnswers = [];
    }

    const userIdStr = authResult.userId.toString();

    // Remove any existing answer for this student/question combo
    assessment.liveSession.studentAnswers = assessment.liveSession.studentAnswers.filter(
      (a: any) => !(a.studentId === userIdStr && a.questionId === questionId)
    );

    // Add new answer
    assessment.liveSession.studentAnswers.push({
      studentId: userIdStr,
      questionId,
      answer,
      answeredAt: new Date(),
      isCorrect,
      timeSpent
    });

    await assessment.save();

    console.log(`📝 Student ${userIdStr} answered question ${questionId}: ${isCorrect ? '✅' : '❌'}`);

    return NextResponse.json({
      success: true,
      data: {
        isCorrect,
        questionId
      }
    });

  } catch (error) {
    console.error('Error submitting live answer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
