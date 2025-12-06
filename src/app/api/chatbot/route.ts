import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/winston';
import { connectToDatabase } from '@/lib/mongoose';
import { authenticate } from '@/lib/middleware/authenticate';
import { ChatbotService } from '@/lib/ai/chatbot-service';
import { containsProfanity, findProfanity } from '@/lib/ai/profanity-filter';

// ChatMessage type definition
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export async function POST(req: NextRequest) {
  // Declare variables outside try block so they're accessible in catch
  let userId: string | undefined;
  let isAuthenticated = false;

  try {
    await connectToDatabase();

    // Try to authenticate, but don't fail if not authenticated (chatbot works for both)
    const authResult = await authenticate(req);
    if (!(authResult instanceof Response)) {
      // User is authenticated
      userId = authResult.userId.toString();
      isAuthenticated = true;
    }
    // If authResult is a Response, user is not authenticated - that's okay for chatbot

    const body = await req.json();
    const { message, conversationHistory, uploadedContent, uploadedFileName, generationParams } = body;

    // Basic profanity check: block requests containing vulgar words
    const messageProfanity = findProfanity(message);
    if (messageProfanity.length > 0) {
      logger.warn('Blocked chat request due to profanity in message', { matches: messageProfanity });
      return NextResponse.json({ error: 'Message contains prohibited language' }, { status: 400 });
    }

    // Also check uploaded content if present
    const uploadedProfanity = findProfanity(uploadedContent);
    if (uploadedProfanity.length > 0) {
      logger.warn('Blocked chat request due to profanity in uploaded content', { matches: uploadedProfanity });
      return NextResponse.json({ error: 'Uploaded content contains prohibited language' }, { status: 400 });
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    logger.info('Chatbot request received', {
      isAuthenticated,
      userId,
      messageLength: message.length,
      hasUploadedContent: !!uploadedContent,
      hasGenerationParams: !!generationParams
    });

    // If generation parameters are provided, trigger generation
    // This calls the existing generation APIs (flashcard, summary, practice test)
    // which use their own AI generators and API keys
    if (generationParams && isAuthenticated && userId) {
      const { type, params } = generationParams;
      
      try {
        let generationResult;
        
        if (type === 'flashcard') {
          if (!uploadedContent) {
            throw new Error('No content provided for flashcard generation');
          }
          
          // Import and use the flashcard generator directly
          const { FlashcardGenerator } = await import('@/lib/ai/flashcard-generator');
          const Flashcard = (await import('@/models/flashcard')).default;
          const { Types } = await import('mongoose');
          const { logActivity } = await import('@/lib/activity');
          
          const generator = new FlashcardGenerator();
          
          // Truncate content if too long (50,000 char limit)
          let processedContent = uploadedContent;
          if (uploadedContent.length > 50000) {
            logger.warn('Content exceeds 50,000 characters, truncating', {
              originalLength: uploadedContent.length
            });
            processedContent = uploadedContent.substring(0, 50000);
          }
          
          const result = await generator.generateFlashcards({
            content: processedContent,
            title: params.title || 'AI Generated Flashcards',
            difficulty: 'medium',
            contentType: 'text',
            maxCards: params.numCards || 10
          });

          // Save to database
          const flashcardData = {
            user: new Types.ObjectId(userId),
            title: params.title || result.analysis.subject + ' Flashcards',
            description: `Generated via chatbot with ${result.analysis.strategy} strategy.`,
            cards: result.flashcards.map(card => ({
              question: card.question,
              answer: card.answer,
              metadata: {
                difficulty: card.difficulty,
                topic: card.topic,
                type: card.type,
                confidence: card.confidence,
                aiGenerated: true
              }
            })),
            difficulty: result.analysis.difficulty,
            tags: ['ai-generated', 'chatbot', result.analysis.subject.toLowerCase()],
            accessType: 'private' as const,
            aiMetadata: {
              generator: 'internal',
              analysis: result.analysis,
              qualityMetrics: result.qualityMetrics,
              generatedAt: new Date()
            }
          };

          const flashcard = new Flashcard(flashcardData);
          await flashcard.save();

          await logActivity({
            userId: String(userId),
            type: 'flashcard.generate',
            action: 'generated via chatbot',
            meta: {
              flashcardId: String(flashcard._id),
              title: flashcard.title,
              cardCount: result.flashcards.length
            },
            progress: 100
          });

          generationResult = {
            success: true,
            flashcard: {
              id: flashcard._id,
              title: flashcard.title,
              cardsGenerated: result.flashcards.length
            }
          };
          
        } else if (type === 'summary') {
          if (!uploadedContent) {
            throw new Error('No content provided for summary generation');
          }
          
          // Import and use the summary generator directly
          const { InternalSummaryGenerator } = await import('@/lib/ai/internal-summary-generator');
          const { Summary } = await import('@/models/summary');
          const { logActivity } = await import('@/lib/activity');
          
          const generator = new InternalSummaryGenerator();
          
          // Truncate content if too long (100,000 char limit for summaries)
          let processedContent = uploadedContent;
          if (uploadedContent.length > 100000) {
            logger.warn('Content exceeds 100,000 characters, truncating', {
              originalLength: uploadedContent.length
            });
            processedContent = uploadedContent.substring(0, 100000);
          }
          
          // Convert summary length to word count (matching study_mode)
          const getMaxLength = (length: string) => {
            switch (length) {
              case 'short': return 200;
              case 'medium': return 350;
              case 'long': return 500;
              default: return 350;
            }
          };
          
          const maxLength = params.summaryLength ? getMaxLength(params.summaryLength) : 350;
          
          const result = await generator.generateSummary({
            content: processedContent,
            title: params.title || 'AI Generated Summary',
            summaryType: params.summaryType || 'outline',
            maxLength
          });

          // Save to database
          const summaryDoc = new Summary({
            userId,
            title: result.summary.title,
            content: result.summary.content,
            keyPoints: result.summary.keyPoints,
            mainTopics: result.summary.mainTopics,
            wordCount: result.summary.wordCount,
            readingTime: result.summary.readingTime,
            difficulty: result.summary.difficulty,
            subject: result.summary.subject,
            summaryType: result.summary.summaryType,
            tags: result.summary.tags,
            confidence: result.summary.confidence,
            originalWordCount: result.originalWordCount,
            compressionRatio: result.compressionRatio,
            sourceType: 'text',
            isPublic: false
          });

          await summaryDoc.save();

          await logActivity({
            userId: String(userId),
            type: 'summary.generate',
            action: 'generated via chatbot',
            meta: {
              summaryId: String(summaryDoc._id),
              title: summaryDoc.title,
              wordCount: summaryDoc.wordCount
            },
            progress: 100
          });

          generationResult = {
            success: true,
            summary: {
              id: summaryDoc._id,
              title: summaryDoc.title,
              wordCount: summaryDoc.wordCount
            }
          };
          
        } else if (type === 'practice_test') {
          if (!uploadedContent) {
            throw new Error('No content provided for practice test generation');
          }
          
          // Import and use the practice test generator directly
          const { PracticeTestGenerator } = await import('@/lib/ai/practice-test-generator');
          const { logActivity } = await import('@/lib/activity');
          
          const generator = new PracticeTestGenerator();
          
          // Truncate content if too long
          let processedContent = uploadedContent;
          if (uploadedContent.length > 50000) {
            logger.warn('Content exceeds 50,000 characters, truncating', {
              originalLength: uploadedContent.length
            });
            processedContent = uploadedContent.substring(0, 50000);
          }
          
          const result = await generator.generatePracticeTest({
            content: processedContent,
            title: params.title || 'AI Generated Practice Test',
            maxQuestions: params.maxQuestions || 20,
            includeMultipleChoice: params.includeMultipleChoice !== false,
            includeWritten: params.includeWritten !== false,
            difficulty: params.difficulty || 'medium',
            timeLimit: params.timeLimit || 30
          });

          await logActivity({
            userId: String(userId),
            type: 'practice_test.generate',
            action: 'generated via chatbot',
            meta: {
              title: result.title,
              questionCount: result.multipleChoiceQuestions.length + result.writtenQuestions.length,
              totalPoints: result.totalPoints
            },
            progress: 100
          });

          generationResult = {
            success: true,
            practiceTest: {
              title: result.title,
              questionCount: result.multipleChoiceQuestions.length + result.writtenQuestions.length
            }
          };
        }
        
        if (generationResult?.success) {
          const itemId = generationResult.flashcard?.id || generationResult.summary?.id;
          const libraryUrl = type === 'flashcard' 
            ? `/student_page/library?tab=flashcards${itemId ? `&highlight=${itemId}` : ''}`
            : type === 'summary'
            ? `/student_page/summaries`
            : `/student_page/library?tab=practice_tests`;

          return NextResponse.json({
            message: `✅ Great! I've successfully generated your ${type === 'flashcard' ? 'flashcards' : type === 'summary' ? 'summary' : 'practice test'}!\n\n📚 Click the button below to view it in your library.`,
            context: 'authenticated',
            generationSuccess: true,
            generationType: type,
            generationResult,
            libraryUrl
          });
        } else {
          throw new Error('Generation failed');
        }
        
      } catch (genError) {
        logger.error('Generation error:', genError);
        return NextResponse.json({
          message: `❌ Sorry, I encountered an error while generating your ${generationParams.type}. ${genError instanceof Error ? genError.message : 'Please try again.'}`,
          context: 'authenticated',
          generationSuccess: false
        });
      }
    }

    const chatbot = new ChatbotService();

    const response = await chatbot.chat(message, {
      isAuthenticated,
      userId,
      conversationHistory: conversationHistory as ChatMessage[],
      uploadedContent,
      uploadedFileName
    });

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Chatbot API error:', {
      error: errorMessage,
      stack: errorStack,
      isAuthenticated,
      userId
    });

    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
