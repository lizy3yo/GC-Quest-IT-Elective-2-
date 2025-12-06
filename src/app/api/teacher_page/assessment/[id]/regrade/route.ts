import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * POST /api/teacher_page/assessment/[id]/regrade
 * Re-grade all submissions for an assessment (fixes opt-0 issue)
 */
export async function POST(
  request: NextRequest,
  context: any
) {
  const params = await context.params;
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Authorize teacher role
    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    await connectToDatabase();

    const { id: assessmentId } = params;

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId).lean() as any;
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Find all submissions for this assessment
    const submissions = await Submission.find({ assessmentId });

    let regradedCount = 0;
    const errors: string[] = [];

    for (const submission of submissions) {
      try {
        // Re-calculate score based on correct answers
        let totalScore = 0;
        let maxPossibleScore = 0;
        const gradedAnswers: any[] = [];

        for (const question of assessment.questions) {
          // Skip non-gradable question types
          if (['title', 'section', 'image'].includes(question.type)) {
            continue;
          }

          const studentAnswer = submission.answers.find((a: any) => a.questionId === question.id);
          const questionPoints = question.points || 1;
          maxPossibleScore += questionPoints;

          let isCorrect = false;
          let partialScore = 0;

          if (studentAnswer) {
            switch (question.type) {
              case 'mcq':
                // Convert student answer from option ID to text if needed
                let studentAnswerText = studentAnswer.answer;
                if (typeof studentAnswerText === 'string' && studentAnswerText.startsWith('opt-')) {
                  const optionIndex = parseInt(studentAnswerText.split('-')[1]);
                  if (!isNaN(optionIndex) && question.options && question.options[optionIndex]) {
                    studentAnswerText = question.options[optionIndex];
                  }
                }
                
                // Use correctAnswer field for MCQ questions
                if (question.correctAnswer !== undefined) {
                  if (typeof question.correctAnswer === 'number') {
                    const correctOptionText = question.options && question.options[question.correctAnswer];
                    isCorrect = studentAnswerText === correctOptionText;
                  } else {
                    isCorrect = studentAnswerText === question.correctAnswer;
                  }
                  partialScore = isCorrect ? questionPoints : 0;
                } else {
                  isCorrect = studentAnswerText === question.answer;
                  partialScore = isCorrect ? questionPoints : 0;
                }
                break;

              case 'identification':
                const identificationCorrect = question.correctAnswer || question.answer;
                if (identificationCorrect) {
                  let studentAnswerText = studentAnswer.answer;
                  if (typeof studentAnswerText === 'string' && studentAnswerText.startsWith('opt-')) {
                    const optionIndex = parseInt(studentAnswerText.split('-')[1]);
                    if (!isNaN(optionIndex) && question.options && question.options[optionIndex]) {
                      studentAnswerText = question.options[optionIndex];
                    }
                  }
                  isCorrect = studentAnswerText?.toString().trim().toLowerCase() === identificationCorrect.toString().trim().toLowerCase();
                  partialScore = isCorrect ? questionPoints : 0;
                }
                break;

              case 'checkboxes':
                let correctOptions: string[] = [];
                
                if (question.correctAnswer !== undefined) {
                  if (Array.isArray(question.correctAnswer)) {
                    if (question.correctAnswer.length > 0 && typeof question.correctAnswer[0] === 'number') {
                      correctOptions = question.correctAnswer
                        .map((index: number) => question.options && question.options[index])
                        .filter((text: string) => text !== undefined);
                    } else {
                      correctOptions = question.correctAnswer as string[];
                    }
                  } else {
                    correctOptions = [question.correctAnswer as string];
                  }
                } else {
                  correctOptions = Array.isArray(question.answer) ? question.answer : [question.answer];
                }
                
                // Convert student options from IDs to text if needed
                let studentOptions = Array.isArray(studentAnswer.answer) ? studentAnswer.answer : [];
                studentOptions = studentOptions.map((opt: string) => {
                  if (typeof opt === 'string' && opt.startsWith('opt-')) {
                    const optionIndex = parseInt(opt.split('-')[1]);
                    if (!isNaN(optionIndex) && question.options && question.options[optionIndex]) {
                      return question.options[optionIndex];
                    }
                  }
                  return opt;
                });
                
                const correctSelected = correctOptions.every((opt: string) => studentOptions.includes(opt));
                const noIncorrectSelected = studentOptions.every((opt: string) => correctOptions.includes(opt));
                
                isCorrect = correctSelected && noIncorrectSelected && correctOptions.length > 0;
                partialScore = isCorrect ? questionPoints : 0;
                break;

              case 'short':
              case 'paragraph':
                // Keep existing manual grades
                const existingGrade = submission.gradedAnswers?.find((ga: any) => ga.questionId === question.id);
                if (existingGrade && existingGrade.isManuallyGraded) {
                  partialScore = existingGrade.points;
                  isCorrect = existingGrade.isCorrect;
                } else {
                  partialScore = 0;
                  isCorrect = false;
                }
                break;

              default:
                partialScore = 0;
                break;
            }
          }

          totalScore += partialScore;

          gradedAnswers.push({
            questionId: question.id,
            studentAnswer: studentAnswer?.answer || null,
            correctAnswer: question.correctAnswer || question.answer,
            isCorrect,
            points: partialScore,
            maxPoints: questionPoints,
            needsManualGrading: question.requiresManualGrading || ['short', 'paragraph'].includes(question.type)
          });
        }

        // Calculate percentage score
        const percentageScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

        // Update submission
        submission.gradedAnswers = gradedAnswers;
        submission.score = Math.round(percentageScore * 100) / 100;
        submission.maxScore = maxPossibleScore;
        
        await submission.save();
        regradedCount++;

      } catch (error) {
        console.error(`Error regrading submission ${submission._id}:`, error);
        errors.push(`Submission ${submission._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        regradedCount,
        totalSubmissions: submissions.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Error regrading assessment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
