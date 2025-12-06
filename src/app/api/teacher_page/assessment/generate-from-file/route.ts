import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';
import { generateAssessment, validateGeneratedAssessment } from '@/lib/ai/assessment-generator';
import { UploadFile } from '@/app/lib/upload';
import Assessment from '@/models/assessment';
import User from '@/models/user';
import { Types } from 'mongoose';
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const category = (formData.get('category') as 'Quiz' | 'Exam') || 'Quiz';
    const difficulty = (formData.get('difficulty') as 'easy' | 'medium' | 'hard') || 'medium';
    const questionCount = parseInt((formData.get('questionCount') as string) || '20');
    const timeLimit = parseInt((formData.get('timeLimit') as string) || '0');
    const includeExplanations = formData.get('includeExplanations') !== 'false';
    const classId = formData.get('classId') as string;
    const subject = formData.get('subject') as string;
    const gradeLevel = formData.get('gradeLevel') as string;
    const dueDate = formData.get('dueDate') as string;
    const availableFrom = formData.get('availableFrom') as string;
    const availableUntil = formData.get('availableUntil') as string;
    const autoPublish = formData.get('autoPublish') === 'true';
    
    // Parse questionTypes from JSON string
    let questionTypes;
    const questionTypesStr = formData.get('questionTypes') as string;
    if (questionTypesStr) {
      try {
        questionTypes = JSON.parse(questionTypesStr);
      } catch (e) {
        logger.warn('Failed to parse questionTypes', { questionTypesStr });
      }
    }

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }

    // Validate file size (10MB limit)
    const maxFileSize = 10 * 1024 * 1024;
    if (file.size > maxFileSize) {
      return NextResponse.json({
        success: false,
        error: 'File size too large',
        details: `File size is ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum allowed size is 10MB.`
      }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Unsupported file type',
        details: 'Please upload PDF, Word, or text files only.'
      }, { status: 400 });
    }

    logger.info('Starting file-based assessment generation', {
      userId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      category,
      questionCount
    });

    // Upload file to Cloudinary
    const uploadResult = await UploadFile(file, 'assessment-files') as any;
    
    if (!uploadResult || !uploadResult.secure_url) {
      return NextResponse.json({
        success: false,
        error: 'Failed to upload file'
      }, { status: 500 });
    }

    logger.info('File uploaded to Cloudinary', {
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url
    });

    // Extract text content from file
    let textContent: string = '';

    if (file.type.includes('text') || file.type.includes('txt') || file.type.includes('markdown')) {
      // For text files, extract content directly
      try {
        const response = await fetch(uploadResult.secure_url);
        if (response.ok) {
          textContent = await response.text();
          logger.info('Extracted text from text file', { contentLength: textContent.length });
        }
      } catch (error) {
        logger.error('Failed to extract text from file', { error });
        return NextResponse.json({
          success: false,
          error: 'Failed to extract text from file'
        }, { status: 500 });
      }
    } else if (file.type.includes('pdf')) {
      // For PDF files, extract text using pdf-parse
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdfData = await pdfParse(buffer);
        textContent = pdfData.text;
        
        logger.info('Extracted text from PDF', { 
          contentLength: textContent.length,
          pages: pdfData.numpages
        });
      } catch (error) {
        logger.error('Failed to extract text from PDF', { error });
        return NextResponse.json({
          success: false,
          error: 'Failed to extract text from PDF. Please try a text-based PDF or upload as text.'
        }, { status: 500 });
      }
    } else {
      // For Word documents, return error for now (would need additional library)
      return NextResponse.json({
        success: false,
        error: 'Word document processing not yet supported. Please convert to PDF or text.',
        details: 'We are working on adding Word document support. For now, please save as PDF or paste the text directly.'
      }, { status: 400 });
    }

    // Validate extracted content
    if (!textContent || textContent.trim().length < 100) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient content',
        details: 'The file does not contain enough text to generate questions. Please provide at least 100 characters of content.'
      }, { status: 400 });
    }

    // Generate assessment using AI
    const generatedAssessment = await generateAssessment({
      content: textContent,
      category,
      questionCount,
      difficulty,
      timeLimit: timeLimit > 0 ? timeLimit : undefined,
      includeExplanations,
      subject: subject || 'General',
      gradeLevel: gradeLevel || 'High School',
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

    // Transform questions to match the Assessment model schema
    // The AI returns options as strings, but the model expects objects with { id, text, isCorrect }
    const transformedQuestions = generatedAssessment.questions.map((q: any) => {
      const transformed: any = {
        id: q.id,
        type: q.type,
        title: q.title,
        required: q.required ?? true,
        points: q.points || (category === 'Exam' ? 5 : 2),
        answer: q.answer,
        correctAnswer: q.correctAnswer
      };

      // Transform options from strings to objects if they exist
      if (q.options && Array.isArray(q.options)) {
        transformed.options = q.options.map((opt: any, idx: number) => {
          // If already an object, use it
          if (typeof opt === 'object' && opt !== null) {
            return {
              id: opt.id || `opt_${idx}`,
              text: opt.text || String(opt),
              isCorrect: opt.isCorrect ?? (q.correctAnswer === opt.text || q.correctAnswer === opt)
            };
          }
          // If string, convert to object
          return {
            id: `opt_${idx}`,
            text: String(opt),
            isCorrect: q.correctAnswer === opt
          };
        });
      }

      return transformed;
    });

    // Create assessment in database
    const assessment = new Assessment({
      title: title || generatedAssessment.title,
      description: generatedAssessment.description,
      type: generatedAssessment.type,
      category: generatedAssessment.category,
      format: 'online',
      questions: transformedQuestions,
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
      instructions: `AI-generated ${category} based on uploaded content: ${file.name}`,
      attachments: [{
        name: file.name,
        url: uploadResult.secure_url,
        type: file.type,
        size: file.size,
        cloudinaryPublicId: uploadResult.public_id,
        resourceType: uploadResult.resource_type,
        format: uploadResult.format
      }],
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
    logger.error('Error generating assessment from file', { 
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
