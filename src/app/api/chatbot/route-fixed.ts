import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/winston';
import { connectToDatabase } from '@/lib/mongoose';
import { authenticate } from '@/lib/middleware/authenticate';

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
    if (generationParams && isAuthenticated && userId) {
      const { type, params } = generationParams;
      
      try {
        let generationResult;
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        
        if (type === 'flashcard') {
          if (!uploadedContent) {
            throw new Error('No content provided for flashcard generation');
          }
          
          // Truncate content if too long (50,000 char limit)
          let processedContent = uploadedContent;
          if (uploadedContent.length > 50000) {
            logger.warn('Content exceeds 50,000 characters, truncating', {
              originalLength: uploadedContent.length
            });
            processedContent = uploadedContent.substring(0, 50000);
          }
          
          // Call the existing flashcard generation API
          const flashcardResponse = await fetch(`${baseUrl}/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: processedContent,
              title: params.title || undefined,
              maxCards: params.numCards || 20,
              aiProvider: 'gemini'
            })
          });

          generationResult = await flashcardResponse.json();
          
        } else if (type === 'summary') {
          if (!uploadedContent) {
            throw new Error('No content provided for summary generation');
          }
          
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
          
          // Call the existing summary generation API
          const summaryResponse = await fetch(`${baseUrl}/api/student_page/summary/generate-from-text?userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: processedContent,
              title: params.title || undefined,
              summaryType: params.summaryType || 'outline',
              maxLength
            })
          });

          generationResult = await summaryResponse.json();
          
        } else if (type === 'practice_test') {
          if (!uploadedContent) {
            throw new Error('No content provided for practice test generation');
          }
          
          // Truncate content if too long
          let processedContent = uploadedContent;
          if (uploadedContent.length > 50000) {
            logger.warn('Content exceeds 50,000 characters, truncating', {
              originalLength: uploadedContent.length
            });
            processedContent = uploadedContent.substring(0, 50000);
          }
          
          // Call the existing practice test generation API
          const testResponse = await fetch(`${baseUrl}/api/student_page/practice-test/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              source: 'paste',
              pastedText: processedContent,
              title: params.title || undefined,
              maxQuestions: params.maxQuestions || 20,
              includeMultipleChoice: params.includeMultipleChoice !== false,
              includeWritten: params.includeWritten !== false,
              difficulty: params.difficulty || 'medium',
              timeLimit: params.timeLimit || 30
            })
          });

          generationResult = await testResponse.json();
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

    // For regular chat messages (not generation), return a simple response
    // Since ChatbotService doesn't exist, we'll return a basic response
    return NextResponse.json({
      message: "I'm here to help you generate flashcards, summaries, and practice tests! Upload a file or paste some text to get started.",
      context: isAuthenticated ? 'authenticated' : 'landing',
      suggestions: isAuthenticated ? [
        "How do I create flashcards?",
        "How do I generate a summary?",
        "What features does GC Quest offer?"
      ] : [
        "What is GC Quest?",
        "How does it work?",
        "What can I create?"
      ]
    });

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
