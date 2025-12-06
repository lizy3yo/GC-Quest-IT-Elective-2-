import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';
import { generateAssessment, validateGeneratedAssessment } from '@/lib/ai/assessment-generator';
import Assessment from '@/models/assessment';
import User from '@/models/user';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    const userId = authResult.userId.toString();

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    const body = await request.json();
    const {
      content,
      title,
      category = 'Quiz',
      difficulty = 'medium',
      questionCount = 20,
      timeLimit = 0,
      includeExplanations = true,
      classId,
      subject = 'General',
      gradeLevel = 'High School',
      dueDate,
      availableFrom,
      availableUntil,
      autoPublish = false,
      questionTypes
    } = body;

    // Validate required fields
    if (!content || typeof content !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Content is required'
      }, { status: 400 });
    }

    // Validate content length
    if (content.trim().length < 100) {
      return NextResponse.json({
        success: false,
        error: 'Content too short',
        details: 'Please provide at least 100 characters of content to generate meaningful questions.'
      }, { status: 400 });
    }

    if (content.length > 100000) {
      return NextResponse.json({
        success: false,
        error: 'Content too long',
        details: 'Please limit content to 100,000 characters. Consider uploading as a file for longer content.'
      }, { status: 400 });
    }

    // Validate category
    if (!['Quiz', 'Exam'].includes(category)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid category',
        details: 'Category must be either "Quiz" or "Exam"'
      }, { status: 400 });
    }

    logger.info('Starting text-based assessment generation', {
      userId,
      category,
      questionCount,
      difficulty,
      contentLength: content.length
    });

    // Generate assessment using AI
    const generatedAssessment = await generateAssessment({
      content,
      category: category as 'Quiz' | 'Exam',
      questionCount,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      timeLimit: timeLimit > 0 ? timeLimit : undefined,
      includeExplanations,
      subject,
      gradeLevel,
      questionTypes
    });

    // Validate generated assessment
    if (!validateGeneratedAssessment(generatedAssessment)) {
      return NextResponse.json({
        success: false,
        error: 'Generated assessment validation failed',
        details: 'The AI generated an invalid assessment. Please try again.'
      }, { status: 500 });
    }

    // Create assessment in database
    const assessment = new Assessment({
      title: title || generatedAssessment.title,
      description: generatedAssessment.description,
      type: generatedAssessment.type,
      category: generatedAssessment.category,
      format: 'online',
      questions: generatedAssessment.questions,
      classId: classId || undefined,
      teacherId: userId,
      timeLimitMins: generatedAssessment.timeLimitMins,
      maxAttempts: category === 'Exam' ? 1 : 3,
      published: autoPublish, // Auto-publish if class is selected
      totalPoints: generatedAssessment.totalPoints,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      availableFrom: availableFrom ? new Date(availableFrom) : new Date(),
      availableUntil: availableUntil ? new Date(availableUntil) : undefined,
      shuffleQuestions: false,
      shuffleOptions: true,
      showResults: category === 'Quiz' ? 'immediately' : 'after_due',
      allowReview: true,
      passingScore: category === 'Exam' ? 70 : undefined,
      instructions: `AI-generated ${category} based on pasted content`,
      attachments: [],
      settings: {
        lockdown: category === 'Exam',
        showProgress: true,
        allowBacktrack: category === 'Quiz',
        autoSubmit: true
      }
    });

    // Generate access code if auto-publishing
    if (autoPublish) {
      assessment.accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    await assessment.save();

    logger.info('Assessment created successfully', {
      assessmentId: assessment._id,
      category,
      questionsGenerated: assessment.questions.length,
      totalPoints: assessment.totalPoints,
      published: assessment.published,
      accessCode: assessment.accessCode
    });

    return NextResponse.json({
      success: true,
      data: {
        assessment: {
          id: assessment._id,
          title: assessment.title,
          description: assessment.description,
          category: assessment.category,
          questionsGenerated: assessment.questions.length,
          totalPoints: assessment.totalPoints,
          timeLimitMins: assessment.timeLimitMins,
          published: assessment.published,
          accessCode: assessment.accessCode
        }
      }
    }, { status: 201 });

  } catch (error) {
    logger.error('Error generating assessment from text', { 
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('API key')) {
        return NextResponse.json({
          success: false,
          error: 'API Configuration Error',
          details: 'Google AI API key not configured. Please contact administrator.'
        }, { status: 500 });
      }

      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        return NextResponse.json({
          success: false,
          error: 'API Rate Limit',
          details: 'API rate limit exceeded. Please try again later.'
        }, { status: 429 });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to generate assessment',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: 'An unexpected error occurred'
    }, { status: 500 });
  }
}
