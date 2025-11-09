import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';
import { validateContent } from '@/lib/ai/flashcard-generator';
import Flashcard from '@/models/flashcard';
import Class, { IClass, IResource, IClassStudent } from '@/models/class';
import User from '@/models/user';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({
        success: false,
        error: 'Valid user ID is required'
      }, { status: 400 });
    }

    const body = await request.json();
    const { 
      classId,
      resourceId,
      title, 
      difficulty, 
      aiProvider = 'gemini',
      folderId,
      tags = [],
      maxCards = 20,
      subject
    } = body;

    if (!classId || !resourceId) {
      return NextResponse.json({
        success: false,
        error: 'Class ID and Resource ID are required'
      }, { status: 400 });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Find the class and verify student access
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return NextResponse.json({
        success: false,
        error: 'Class not found'
      }, { status: 404 });
    }

    // Check if user is enrolled in the class
    const isEnrolled = classDoc.students.some(
      (student: IClassStudent) => student.studentId === userId && student.status === 'active'
    );

    if (!isEnrolled) {
      return NextResponse.json({
        success: false,
        error: 'You are not enrolled in this class'
      }, { status: 403 });
    }

    // Find the specific resource
    const resource = classDoc.resources.find((res: IResource) => res.id === resourceId);
    if (!resource) {
      return NextResponse.json({
        success: false,
        error: 'Resource not found in class'
      }, { status: 404 });
    }

    // Check if resource has a valid URL
    if (!resource.url) {
      return NextResponse.json({
        success: false,
        error: 'Resource file is not accessible'
      }, { status: 400 });
    }

    logger.info('Starting class file flashcard generation', {
      userId,
      classId,
      resourceId,
      resourceName: resource.name,
      resourceType: resource.type,
      aiProvider
    });

    // Determine if we can extract text content directly or need external processing
    let textContent: string = '';
    let useZapierOnly = false;

    // Check if it's a text file that we can process directly
    if (resource.type && (resource.type.includes('text') || resource.type.includes('txt'))) {
      try {
        const response = await fetch(resource.url);
        if (response.ok) {
          textContent = await response.text();
          logger.info('Successfully extracted text from class text file', { 
            contentLength: textContent.length 
          });
        }
      } catch (error) {
        logger.warn('Failed to extract text from class text file, will use Zapier only', { error });
        useZapierOnly = true;
      }
    } else if (resource.type && (resource.type.includes('pdf') || resource.type.includes('application/pdf'))) {
      // For PDF files, try to extract text directly
      try {
        logger.info('Attempting to extract text from class PDF file');
        
        // Import pdf-parse
        const pdfParse = (await import('pdf-parse')).default;
        
        // Fetch the PDF file
        const response = await fetch(resource.url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Parse PDF
          const pdfData = await pdfParse(buffer);
          textContent = pdfData.text;
          
          logger.info('Successfully extracted text from class PDF', { 
            contentLength: textContent.length,
            pages: pdfData.numpages
          });
          
          // If we have good text content, don't use Zapier only
          if (textContent.length > 100) {
            useZapierOnly = false;
          }
        }
      } catch (error) {
        logger.warn('Failed to extract text from class PDF file', { error });
        useZapierOnly = true;
      }
    } else {
      // For other binary files (DOCX, etc.), we need external processing
      useZapierOnly = true;
      logger.info('Binary class file detected, using Zapier for text extraction', { 
        resourceType: resource.type,
        resourceName: resource.name 
      });
    }

    // Process the extracted text content
    let result: any = null;
    
    if (textContent) {
      // Validate extracted content
      const validation = validateContent(textContent);
      if (validation.isValid) {
        try {
          // Use AI generator for results
          const { FlashcardGenerator } = await import('@/lib/ai/flashcard-generator');
          const generator = new FlashcardGenerator();
          
          result = await generator.generateFlashcards({
            content: textContent,
            title: title || resource.name,
            difficulty: difficulty as 'easy' | 'medium' | 'hard',
            contentType: 'document',
            maxCards: parseInt(maxCards) || 20
          });

          logger.info('AI generation successful for class file', {
            resourceName: resource.name,
            cardsGenerated: result.flashcards.length,
            qualityScore: result.qualityMetrics.overallScore
          });

        } catch (error) {
          logger.error('AI generation failed for class file', { error, resourceName: resource.name });
        }
      } else {
        logger.warn('Extracted content validation failed', { 
          resourceName: resource.name, 
          validationError: validation.error,
          contentLength: textContent.length 
        });
      }
    }

    // If we couldn't generate cards, return an error
    if (!result || !result.flashcards || result.flashcards.length === 0) {
      logger.warn('No flashcards could be generated from class file', {
        resourceName: resource.name,
        resourceType: resource.type,
        className: classDoc.name,
        textContentLength: textContent.length
      });
      
      return NextResponse.json({
        success: false,
        error: 'Could not generate flashcards from class file content',
        details: `The class file "${resource.name}" could not be processed to extract meaningful content for flashcard generation. Please ensure the file contains readable text content.`
      }, { status: 400 });
    }

    // Create flashcard set in database
    const flashcardData = {
      user: new Types.ObjectId(userId),
      folder: folderId ? new Types.ObjectId(folderId) : undefined,
      title: title || `${resource.name} - ${classDoc.name}`,
      description: `Generated from class file: ${resource.name} in ${classDoc.name} using AI with ${result.analysis.strategy} strategy. Quality score: ${result.qualityMetrics.overallScore.toFixed(2)}`,
      cards: result.flashcards.map((card: any) => ({
        question: card.question,
        answer: card.answer,
        metadata: {
          difficulty: card.difficulty,
          topic: card.topic,
          type: card.type,
          confidence: card.confidence,
          reasoning: card.reasoning,
          example: card.example,
          commonMistake: card.commonMistake,
          reviewInterval: card.reviewInterval,
          aiGenerated: true
        }
      })),
      difficulty: difficulty || result.analysis.difficulty || 'medium',
      subject: subject || classDoc.subject || undefined,
      tags: [
        ...tags,
        'ai-generated',
        'class-file',
        classDoc.subject.toLowerCase(),
        classDoc.name.toLowerCase().replace(/\s+/g, '-'),
        result.analysis.subject.toLowerCase(),
        result.analysis.strategy,
        ...result.analysis.keyTopics.map((topic: string) => topic.toLowerCase()),
        ...(resource.type ? [resource.type.toLowerCase()] : [])
      ],
      accessType: 'private' as const,

      // Enhanced metadata
      aiMetadata: {
        generator: 'internal',
        analysis: result.analysis,
        qualityMetrics: result.qualityMetrics,
        summary: result.summary,
        generatedAt: new Date(),
        processingMethod: 'class-file-extraction-ai'
      },

      createdAt: new Date(),
      updatedAt: new Date()
    };

    const flashcard = new Flashcard(flashcardData);
    await flashcard.save();

    logger.info('Class file flashcard generation completed', {
      userId,
      classId,
      resourceId,
      flashcardId: flashcard._id,
      cardsGenerated: result.flashcards.length,
      qualityScore: result.qualityMetrics.overallScore
    });

    return NextResponse.json({
      success: true,
      flashcard: {
        id: flashcard._id,
        title: flashcard.title,
        cardsGenerated: result.flashcards.length,
        qualityScore: result.qualityMetrics.overallScore,
        subject: result.analysis.subject,
        keyTopics: result.analysis.keyTopics,
        sourceClass: {
          id: classDoc._id,
          name: classDoc.name,
          subject: classDoc.subject
        },
        sourceResource: {
          id: resource.id,
          name: resource.name,
          type: resource.type
        }
      },
      analysis: result.analysis,
      qualityMetrics: result.qualityMetrics,
      summary: result.summary,
      message: `Successfully generated ${result.flashcards.length} flashcards from ${resource.name}`
    });

  } catch (error) {
    logger.error('Class file flashcard generation failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate flashcards from class file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to fetch available class files for a student
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const classId = searchParams.get('classId');

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({
        success: false,
        error: 'Valid user ID is required'
      }, { status: 400 });
    }

    // If classId is provided, get resources for that specific class
    if (classId) {
      const classDoc = await Class.findById(classId);
      if (!classDoc) {
        return NextResponse.json({
          success: false,
          error: 'Class not found'
        }, { status: 404 });
      }

      // Check if user is enrolled
      const isEnrolled = classDoc.students.some(
        (student: IClassStudent) => student.studentId === userId && student.status === 'active'
      );

      if (!isEnrolled) {
        return NextResponse.json({
          success: false,
          error: 'You are not enrolled in this class'
        }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        class: {
          id: classDoc._id,
          name: classDoc.name,
          subject: classDoc.subject,
          resources: classDoc.resources.map((resource: IResource) => ({
            id: resource.id,
            name: resource.name,
            type: resource.type,
            description: resource.description,
            sizeBytes: resource.sizeBytes,
            uploadedAt: resource.uploadedAt,
            hasUrl: !!resource.url
          }))
        }
      });
    }

    // Get all classes the student is enrolled in with their resources
    const classes = await Class.find({
      'students.studentId': userId,
      'students.status': 'active',
      isActive: true
    }).select('name subject resources students');

    const classesWithResources = classes.map((classDoc: IClass) => ({
      id: classDoc._id,
      name: classDoc.name,
      subject: classDoc.subject,
      resourceCount: classDoc.resources.length,
      resources: classDoc.resources.map((resource: IResource) => ({
        id: resource.id,
        name: resource.name,
        type: resource.type,
        description: resource.description,
        sizeBytes: resource.sizeBytes,
        uploadedAt: resource.uploadedAt,
        hasUrl: !!resource.url
      }))
    }));

    return NextResponse.json({
      success: true,
      classes: classesWithResources
    });

  } catch (error) {
    logger.error('Failed to fetch class files:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch class files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}