import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';
import { validateContent } from '@/lib/ai/flashcard-generator';
import Flashcard from '@/models/flashcard';
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
      content, 
      title, 
      difficulty, 
      subject, 
      aiProvider = 'gemini',
      folderId,
      tags = [],
      maxCards = 20,
      isPublic = false
    } = body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Validate content
    const validation = validateContent(content);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: validation.error
      }, { status: 400 });
    }

    logger.info('Starting text-based flashcard generation', {
      userId,
      contentLength: content.length
    });

    // Use internal AI generator for high-quality results
    const { FlashcardGenerator } = await import('@/lib/ai/flashcard-generator');
    const generator = new FlashcardGenerator();
    
    const result = await generator.generateFlashcards({
      content,
      title: title || 'Text-based Flashcards',
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      contentType: 'text',
      maxCards: parseInt(maxCards) || 20
    });

    // Create enhanced flashcard set with internal AI metadata
    const flashcardData = {
      user: new Types.ObjectId(userId),
      folder: folderId ? new Types.ObjectId(folderId) : undefined,
      title: title || result.analysis.subject + ' Flashcards',
      description: `Generated using AI with ${result.analysis.strategy} strategy. Quality score: ${result.qualityMetrics.overallScore.toFixed(2)}`,
      cards: result.flashcards.map(card => ({
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
      difficulty: result.analysis.difficulty,
      tags: [
        ...tags,
        'ai-generated',
        'text-input',
        result.analysis.subject.toLowerCase(),
        result.analysis.strategy,
        ...result.analysis.keyTopics.map(topic => topic.toLowerCase()),
        ...(subject ? [subject.toLowerCase()] : [])
      ],
      accessType: isPublic ? 'public' as const : 'private' as const,

      // Enhanced metadata from generator
      aiMetadata: {
        generator: 'internal',
        analysis: result.analysis,
        qualityMetrics: result.qualityMetrics,
        summary: result.summary,
        generatedAt: new Date(),
        processingMethod: 'single-step-comprehensive'
      },

      createdAt: new Date(),
      updatedAt: new Date()
    };

    const flashcard = new Flashcard(flashcardData);
    await flashcard.save();

    logger.info('Text-based flashcard generation completed', {
      userId,
      flashcardId: flashcard._id,
      cardsGenerated: result.flashcards.length,
      qualityScore: result.qualityMetrics.overallScore,
      subject: result.analysis.subject
    });

    return NextResponse.json({
      success: true,
      flashcard: {
        id: flashcard._id,
        title: flashcard.title,
        cardsGenerated: result.flashcards.length,
        qualityScore: result.qualityMetrics.overallScore,
        subject: result.analysis.subject,
        keyTopics: result.analysis.keyTopics
      },
      analysis: result.analysis,
      qualityMetrics: result.qualityMetrics,
      summary: result.summary,
      message: `Successfully generated ${result.flashcards.length} high-quality flashcards`
    });

  } catch (error) {
    logger.error('Text-based flashcard generation failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate flashcards',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}