import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

interface StudentAnswer {
  questionId: string;
  answer: string | string[] | { [key: string]: string };
}

interface SubmissionData {
  answers: StudentAnswer[];
  submittedAt: string;
  timeSpent?: number;
}

/**
 * POST /api/student_page/class/[classId]/assessment/[assessmentId]/submit
 * Submit student answers for an assessment
 */
export async function POST(
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
    const submissionData: SubmissionData = await request.json();
    
    console.log('Submission request:', {
      classId,
      assessmentId,
      studentId: authResult.userId,
      answersCount: submissionData.answers?.length || 0,
      submittedAt: submissionData.submittedAt
    });

    // Validate submission data
    if (!submissionData.answers || !Array.isArray(submissionData.answers)) {
      return NextResponse.json({ 
        error: 'Invalid submission data: answers must be an array' 
      }, { status: 400 });
    }

    if (!submissionData.submittedAt) {
      return NextResponse.json({ 
        error: 'Invalid submission data: submittedAt is required' 
      }, { status: 400 });
    }

    // Find the assessment
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      classId: classId,
      published: true
    }).lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found or not available' }, { status: 404 });
    }

    // Check if assessment is still available
    const now = new Date();
    if (assessment.dueDate && now > new Date(assessment.dueDate)) {
      // Allow late submission but mark it as late
    }
    if (assessment.availableUntil && now > assessment.availableUntil) {
      return NextResponse.json({ error: 'Assessment submission period has ended' }, { status: 403 });
    }

    // Check if student has already submitted (if maxAttempts is 1)
    const existingSubmissions = await Submission.find({
      assessmentId: assessmentId,
      studentId: authResult.userId.toString()
    }).lean();

    if (assessment.maxAttempts && existingSubmissions.length >= assessment.maxAttempts) {
      return NextResponse.json({ error: 'Maximum attempts exceeded' }, { status: 403 });
    }

    // Calculate score based on correct answers
    let totalScore = 0;
    let maxPossibleScore = 0;
    const gradedAnswers: any[] = [];

    for (const question of assessment.questions) {
      // Skip non-gradable question types
      if (['title', 'section', 'image'].includes(question.type)) {
        continue;
      }

      const studentAnswer = submissionData.answers.find(a => a.questionId === question.id);
      const questionPoints = question.points || 1;
      maxPossibleScore += questionPoints;

      let isCorrect = false;
      let partialScore = 0;

      if (studentAnswer) {
        switch (question.type) {
          case 'mcq':
            // Use correctAnswer field for MCQ questions
            if (question.correctAnswer !== undefined) {
              // Handle both old format (index) and new format (text)
              if (typeof question.correctAnswer === 'number') {
                // Old format: correctAnswer is an index
                const correctOptionText = question.options && question.options[question.correctAnswer];
                isCorrect = studentAnswer.answer === correctOptionText;
              } else {
                // New format: correctAnswer is the actual text
                isCorrect = studentAnswer.answer === question.correctAnswer;
              }
              partialScore = isCorrect ? questionPoints : 0;
            } else {
              // Fallback to old answer field for backward compatibility
              isCorrect = studentAnswer.answer === question.answer;
              partialScore = isCorrect ? questionPoints : 0;
            }
            break;

          case 'identification':
            // Use answer field for identification questions
            isCorrect = studentAnswer.answer === question.answer;
            partialScore = isCorrect ? questionPoints : 0;
            break;

          case 'checkboxes':
            // Use correctAnswer field for checkbox questions
            let correctOptions: string[] = [];
            
            if (question.correctAnswer !== undefined) {
              if (Array.isArray(question.correctAnswer)) {
                // Check if it's an array of indices or texts
                if (question.correctAnswer.length > 0 && typeof question.correctAnswer[0] === 'number') {
                  // Old format: array of indices
                  correctOptions = question.correctAnswer
                    .map((index: number) => question.options && question.options[index])
                    .filter((text: string) => text !== undefined);
                } else {
                  // New format: array of texts
                  correctOptions = question.correctAnswer as string[];
                }
              } else {
                // Single correct answer
                correctOptions = [question.correctAnswer as string];
              }
            } else {
              // Fallback to old answer field
              correctOptions = Array.isArray(question.answer) ? question.answer : [question.answer];
            }
            
            const studentOptions = Array.isArray(studentAnswer.answer) ? studentAnswer.answer : [];
            
            const correctSelected = correctOptions.every((opt: string) => studentOptions.includes(opt));
            const noIncorrectSelected = studentOptions.every((opt: string) => correctOptions.includes(opt));
            
            isCorrect = correctSelected && noIncorrectSelected && correctOptions.length > 0;
            partialScore = isCorrect ? questionPoints : 0;
            break;

          case 'enumeration':
            // For enumeration, check if student answer contains expected items
            if (question.items && Array.isArray(question.items)) {
              const studentItems = (studentAnswer.answer as string).toLowerCase().split('\n').map(s => s.trim()).filter(s => s);
              const expectedItems = question.items.map((item: any) => item.toLowerCase());
              
              const correctItems = studentItems.filter((item: any) => 
                expectedItems.some((expected: any) => expected.includes(item) || item.includes(expected))
              );
              
              partialScore = (correctItems.length / expectedItems.length) * questionPoints;
              isCorrect = partialScore === questionPoints;
            }
            break;

          case 'match':
            // For matching, check each pair
            if (question.pairs && Array.isArray(question.pairs)) {
              const studentMatches = studentAnswer.answer as { [key: string]: string };
              let correctMatches = 0;
              
              for (const pair of question.pairs) {
                if (pair.right && studentMatches[pair.left]?.toLowerCase().trim() === pair.right.toLowerCase().trim()) {
                  correctMatches++;
                }
              }
              
              partialScore = (correctMatches / question.pairs.length) * questionPoints;
              isCorrect = partialScore === questionPoints;
            }
            break;

          case 'short':
          case 'paragraph':
            // These require manual grading - give 0 points initially
            partialScore = 0;
            isCorrect = false; // Will be determined by teacher
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
        correctAnswer: question.correctAnswer || question.answer, // Use correctAnswer if available
        isCorrect,
        points: partialScore,
        maxPoints: questionPoints,
        needsManualGrading: question.requiresManualGrading || ['short', 'paragraph'].includes(question.type)
      });
      
      // Debug logging for grading
      console.log(`Question ${question.id} (${question.type}):`, {
        studentAnswer: studentAnswer?.answer,
        correctAnswer: question.correctAnswer || question.answer,
        isCorrect,
        points: partialScore,
        maxPoints: questionPoints,
        needsManualGrading: question.requiresManualGrading || ['short', 'paragraph'].includes(question.type)
      });
    }

    // Calculate percentage score
    const percentageScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

    // Determine if submission is late
    const isLate = assessment.dueDate && new Date(submissionData.submittedAt) > new Date(assessment.dueDate);
    
    // Determine submission status
    const needsManualGrading = gradedAnswers.some(a => a.needsManualGrading);
    let submissionStatus: string;
    
    if (isLate) {
      submissionStatus = 'late';
    } else if (needsManualGrading) {
      submissionStatus = 'submitted'; // Needs manual grading, so not fully graded yet
    } else {
      submissionStatus = 'graded'; // All questions are auto-graded, so submission is complete
    }

    console.log('Submission grading summary:', {
      totalQuestions: assessment.questions.length,
      gradedQuestions: gradedAnswers.length,
      totalScore,
      maxPossibleScore,
      percentageScore: Math.round(percentageScore * 100) / 100,
      needsManualGrading,
      submissionStatus,
      questionsNeedingManualGrading: gradedAnswers.filter(ga => ga.needsManualGrading).length,
      autoGradedQuestions: gradedAnswers.filter(ga => !ga.needsManualGrading).length
    });

    console.log('Creating submission with data:', {
      assessmentId,
      studentId: authResult.userId.toString(),
      classId,
      type: 'quiz_submission',
      answersCount: submissionData.answers.length,
      gradedAnswersCount: gradedAnswers.length,
      score: Math.round(percentageScore * 100) / 100,
      maxScore: 100,
      status: submissionStatus,
      needsManualGrading: needsManualGrading,
      attemptNumber: existingSubmissions.length + 1
    });

    // Create submission record
    const submission = new Submission({
      assessmentId: assessmentId,
      studentId: authResult.userId.toString(),
      classId: classId,
      type: 'quiz_submission', // Required field for online assessments
      answers: submissionData.answers,
      gradedAnswers: gradedAnswers,
      score: Math.round(percentageScore * 100) / 100, // Round to 2 decimal places
      maxScore: 100,
      submittedAt: new Date(submissionData.submittedAt),
      timeSpent: submissionData.timeSpent,
      status: submissionStatus,
      needsManualGrading: needsManualGrading,
      attemptNumber: existingSubmissions.length + 1,
      // Set gradedAt if it's fully auto-graded
      gradedAt: needsManualGrading ? undefined : new Date()
    });

    console.log('Saving submission to database...');
    await submission.save();
    console.log('Submission saved successfully:', submission._id);

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission._id.toString(),
        score: submission.score,
        maxScore: submission.maxScore,
        status: submission.status,
        submittedAt: submission.submittedAt,
        needsManualGrading: submission.needsManualGrading
      }
    });

  } catch (error) {
    console.error('Error submitting assessment:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Internal server error';
    let errorDetails = '';
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        errorMessage = 'Validation error';
        errorDetails = error.message;
      } else if (error.name === 'CastError') {
        errorMessage = 'Invalid data format';
        errorDetails = error.message;
      } else {
        errorDetails = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        debug: process.env.NODE_ENV === 'development' ? {
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        } : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/student_page/class/[classId]/assessment/[assessmentId]/submit
 * Get student's submission status for an assessment
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

    // Find student's submissions for this assessment
    const submissions = await Submission.find({
      assessmentId: assessmentId,
      studentId: authResult.userId.toString()
    }).sort({ submittedAt: -1 }).lean();

    // Get assessment details
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      classId: classId
    }).lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        submissions: submissions.map(sub => ({
          id: (sub as any)._id.toString(),
          score: sub.score,
          maxScore: sub.maxScore,
          status: sub.status,
          submittedAt: sub.submittedAt,
          timeSpent: sub.timeSpent,
          attemptNumber: sub.attemptNumber,
          needsManualGrading: sub.needsManualGrading
        })),
        assessment: {
          id: assessment._id.toString(),
          title: assessment.title,
          maxAttempts: assessment.maxAttempts,
          dueDate: assessment.dueDate
        },
        canRetake: !assessment.maxAttempts || submissions.length < assessment.maxAttempts
      }
    });

  } catch (error) {
    console.error('Error fetching submission status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}