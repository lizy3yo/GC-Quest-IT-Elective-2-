import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';
// Ensure Node.js runtime for Buffer and native libs
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Add imports for file parsing libraries
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import iconv from 'iconv-lite';
import { Buffer } from 'node:buffer';
// Add import for Google AI (Gemini)
import { GoogleGenerativeAI } from '@google/generative-ai';
// Import our new AI flashcard generator
import { InternalFlashcardGenerator } from '@/lib/ai/internal-flashcard-generator';

interface AnalysisResult {
  title?: string;
  cards?: Array<{ question: string; answer: string }>,
  difficulty?: string;
  tags?: string[];
  summary?: string;
  content?: string;
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        message: 'User ID is required'
      }, { status: 400 });
    }

    const formData = await request.formData();
    const text = formData.get('text') as string;
    const file = formData.get('file') as File;
    const analysisType = formData.get('analysisType') as string;

    if (!text && !file) {
      return NextResponse.json({
        message: 'Either text or file is required'
      }, { status: 400 });
    }

    let contentToAnalyze = text;

    // Improved file parsing with encoding and format support
    if (file) {
      const fileName = file.name.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
        // Existing logic for TXT/CSV with iconv
        let detectedEncoding = 'utf8';
        try {
          const utf8Text = iconv.decode(buffer, 'utf8');
          if (utf8Text.includes('�')) {
            detectedEncoding = 'latin1';
          }
          contentToAnalyze = iconv.decode(buffer, detectedEncoding);
          logger.info('TXT/CSV parsed successfully', { fileName, contentLength: contentToAnalyze.length });
        } catch (error) {
          logger.error('TXT/CSV parsing failed, falling back to UTF-8', { error, fileName });
          contentToAnalyze = buffer.toString('utf8');
        }
      } else if (fileName.endsWith('.docx')) {
        try {
          const result = await mammoth.extractRawText({ buffer });
          contentToAnalyze = result.value;
          logger.info('DOCX parsed successfully', { fileName, contentLength: contentToAnalyze.length, warnings: result.messages });
          if (result.messages.length > 0) {
            logger.warn('DOCX parsing warnings', { messages: result.messages });
          }
        } catch (error) {
          logger.error('DOCX parsing failed', { error, fileName });
          return NextResponse.json({
            message: 'Failed to parse DOCX file. Ensure it\'s a valid .docx format.'
          }, { status: 400 });
        }
      } else if (fileName.endsWith('.pdf')) {
        try {
          const data = await pdfParse(buffer);
          contentToAnalyze = data.text;
          logger.info('PDF parsed successfully', { fileName, contentLength: contentToAnalyze.length, pages: data.numpages });
        } catch (error) {
          logger.error('PDF parsing failed', { error, fileName });
          return NextResponse.json({
            message: 'Failed to parse PDF file. Ensure it contains extractable text (not scanned images).'
          }, { status: 400 });
        }
      } else {
        return NextResponse.json({
          message: 'Unsupported file type. Please use TXT, CSV, DOCX, or PDF.'
        }, { status: 400 });
      }
    }

    // Use the new AI flashcard generator for better results
    const result = await analyzeContent(contentToAnalyze, analysisType);

    logger.info('Content analyzed successfully', {
      userId,
      analysisType,
      contentLength: contentToAnalyze.length
    });

    return NextResponse.json({
      result,
      message: 'Analysis completed successfully'
    });

  } catch (error) {
    logger.error('Error analyzing content:', error);
    return NextResponse.json({
      message: 'Failed to analyze content',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function analyzeContent(content: string, analysisType: string): Promise<AnalysisResult> {
  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Use the new flashcard generator for better AI-powered flashcard creation
  if (analysisType === 'flashcards' || analysisType === 'quiz') {
    try {
      const generator = new InternalFlashcardGenerator();
      const result = await generator.generateFlashcards({
        content,
        contentType: 'text',
        maxCards: analysisType === 'quiz' ? 15 : 10,
        difficulty: 'medium' // Default difficulty
      });

      return {
        title: generateTitle(content),
        cards: result.flashcards.map(card => ({
          question: card.question,
          answer: card.answer
        })),
        difficulty: result.analysis.difficulty,
        tags: [...result.analysis.keyTopics, 'ai-generated'],
        summary: `Generated ${result.flashcards.length} ${analysisType} cards using AI.`
      };
    } catch (error) {
      logger.warn('AI flashcard generation failed, falling back to legacy method:', error);
      // Fall through to legacy method
    }
  }

  // Handle semantic_distractors analysisType using Gemini
  if (analysisType === 'semantic_distractors') {
    try {
      const result = await model.generateContent(content);
      const response = await result.response;
      const generatedText = response.text();
      return {
        content: generatedText,
      };
    } catch (error) {
      logger.error('Gemini AI generation failed for semantic_distractors:', error);
      // Fallback to simple response
      return {
        content: 'AI generation failed. Please try again.',
      };
    }
  }

  // Handle category_alternatives analysisType using Gemini
  if (analysisType === 'category_alternatives') {
    try {
      const result = await model.generateContent(content);
      const response = await result.response;
      const generatedText = response.text();
      return {
        content: generatedText,
      };
    } catch (error) {
      logger.error('Gemini AI generation failed for category_alternatives:', error);
      // Fallback to simple response
      return {
        content: 'AI generation failed. Please try again.',
      };
    }
  }

  // Clean and preprocess content while preserving newlines for line-based patterns
  const normalizedNewlines = content.replace(/\r\n?/g, '\n');
  const cleanedContent = normalizedNewlines
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .trim();

  const lines = cleanedContent.split('\n').filter(line => line.trim().length > 0);
  const sentences = cleanedContent
    .replace(/\n+/g, ' ') // sentence analysis doesn't need newlines
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  const cards: Array<{ question: string; answer: string }> = [];

  // Prioritize structured patterns (existing logic, but with better checks)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('?') && i + 1 < lines.length) {
      const question = line;
      const answer = lines[i + 1].trim();
      if (answer && !answer.includes('?') && answer.length > 3) {
        cards.push({ question, answer });
        i++; // Skip next
      }
    } else if (line.includes(':')) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const question = parts[0].trim();
        const answer = parts.slice(1).join(':').trim();
        if (question.length > 2 && answer.length > 3) {
          cards.push({ question, answer });
        }
      }
    } else if (line.includes(',')) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const question = parts[0].trim();
        const answer = parts.slice(1).join(',').trim();
        if (question.length > 2 && answer.length > 3) {
          cards.push({ question, answer });
        }
      }
    }
  }

  // Fallback: Create cards from sentences (improved pairing)
  if (cards.length === 0 && sentences.length > 1) {
    for (let i = 0; i < Math.min(sentences.length - 1, 20); i += 2) {
      const potentialQuestion = sentences[i].trim();
      const potentialAnswer = sentences[i + 1]?.trim();
      if (potentialQuestion && potentialAnswer && potentialQuestion.length > 10 && potentialAnswer.length > 5) {
        cards.push({
          question: potentialQuestion.endsWith('?') ? potentialQuestion : potentialQuestion + '?',
          answer: potentialAnswer
        });
      }
    }
  }

  // If still no cards, create a single card with the content summary
  if (cards.length === 0) {
    cards.push({
      question: 'What is the main content?',
      answer: cleanedContent.substring(0, 200) + (cleanedContent.length > 200 ? '...' : '')
    });
  }

  // Generate title
  const title = generateTitle(cleanedContent);

  // Determine difficulty based on content complexity
  const difficulty = determineDifficulty(cleanedContent);

  // Generate tags
  const tags = generateTags(cleanedContent);

  // Branch behavior by analysisType
  if (analysisType === 'summary') {
    const summaryText = summarizeContent(cleanedContent, sentences);
    return {
      title,
      cards: [],
      difficulty,
      tags,
      summary: summaryText,
      content: cleanedContent.substring(0, 1000) + (cleanedContent.length > 1000 ? '...' : '')
    };
  }

  if (analysisType === 'quiz') {
    // Use AI to generate quiz-style questions
    try {
      const generator = new InternalFlashcardGenerator();
      const result = await generator.generateFlashcards({
        content: cleanedContent,
        contentType: 'text',
        maxCards: 12,
        difficulty: difficulty as 'easy' | 'medium' | 'hard'
      });
      const quizCards = result.flashcards;

      if (quizCards && quizCards.length > 0) {
        return {
          title,
          cards: quizCards.map(card => ({ question: card.question, answer: card.answer })),
          difficulty,
          tags: Array.from(new Set([...(tags || []), 'quiz', 'ai-generated'])).slice(0, 8),
          summary: `Generated ${quizCards.length} AI-powered quiz questions from your content.`,
          content: cleanedContent.substring(0, 500) + (cleanedContent.length > 500 ? '...' : '')
        };
      }
    } catch (error) {
      logger.warn('AI quiz generation failed, using fallback method', { error });
    }

    // Fallback to pattern matching
    const quizCards = generateQuizCards(lines, sentences, cleanedContent);
    return {
      title,
      cards: quizCards.slice(0, 20),
      difficulty,
      tags: Array.from(new Set([...(tags || []), 'quiz'])).slice(0, 5),
      summary: `Generated ${quizCards.length} quiz questions from your content.`,
      content: cleanedContent.substring(0, 500) + (cleanedContent.length > 500 ? '...' : '')
    };
  }

  // Default: flashcards - Use AI generation for better quality
  try {
    const generator = new InternalFlashcardGenerator();
    const result = await generator.generateFlashcards({
      content: cleanedContent,
      contentType: 'text',
      maxCards: 15,
      difficulty: difficulty as 'easy' | 'medium' | 'hard'
    });
    const aiCards = result.flashcards;

    if (aiCards && aiCards.length > 0) {
      return {
        title,
        cards: aiCards.map(card => ({ question: card.question, answer: card.answer })),
        difficulty,
        tags: Array.from(new Set([...(tags || []), ...aiCards.flatMap(card => card.tags || [])])).slice(0, 8),
        summary: `Generated ${aiCards.length} AI-powered flashcards from your content.`,
        content: cleanedContent.substring(0, 500) + (cleanedContent.length > 500 ? '...' : '')
      };
    }
  } catch (error) {
    logger.warn('AI flashcard generation failed, using fallback method', { error });
  }

  // Fallback to pattern matching if AI fails
  return {
    title,
    cards: cards.slice(0, 20),
    difficulty,
    tags,
    summary: `Generated ${cards.length} flashcards from ${cleanedContent.length} characters of content.`,
    content: cleanedContent.substring(0, 500) + (cleanedContent.length > 500 ? '...' : '')
  };
}

function generateTitle(content: string): string {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 3 && firstLine.length < 100) {
      return firstLine;
    }
  }

  // Extract key terms for title
  const words = content.split(/\s+/).filter(word =>
    word.length > 3 &&
    !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'said'].includes(word.toLowerCase())
  );

  if (words.length > 0) {
    return `Study Set: ${words.slice(0, 3).join(' ')}`;
  }

  return 'AI Generated Flashcards';
}

function determineDifficulty(content: string): 'easy' | 'medium' | 'hard' {
  const wordCount = content.split(/\s+/).length;
  const avgWordLength = content.replace(/\s+/g, '').length / wordCount;
  const sentenceCount = content.split(/[.!?]+/).length;
  const avgSentenceLength = wordCount / sentenceCount;

  if (avgWordLength > 6 || avgSentenceLength > 20) {
    return 'hard';
  } else if (avgWordLength > 4 || avgSentenceLength > 15) {
    return 'medium';
  } else {
    return 'easy';
  }
}

function generateTags(content: string): string[] {
  const commonTopics = [
    'science', 'history', 'math', 'literature', 'geography',
    'biology', 'chemistry', 'physics', 'english', 'social studies'
  ];

  const contentLower = content.toLowerCase();
  const foundTopics = commonTopics.filter(topic =>
    contentLower.includes(topic)
  );

  // Add generic tags
  const tags = ['ai-generated', ...foundTopics];

  // Add difficulty-based tag
  const difficulty = determineDifficulty(content);
  tags.push(difficulty);

  return tags.slice(0, 5); // Limit to 5 tags
}

function summarizeContent(cleanedContent: string, sentences: string[]): string {
  if (sentences.length === 0) {
    return cleanedContent.substring(0, 300) + (cleanedContent.length > 300 ? '...' : '');
  }
  // Simple extractive summary: pick first, a middle, and last informative sentences
  const picks: string[] = [];
  const informative = sentences.filter(s => s.split(/\s+/).length >= 6);
  if (informative[0]) picks.push(informative[0]);
  if (informative[Math.floor(informative.length / 2)]) picks.push(informative[Math.floor(informative.length / 2)]);
  if (informative[informative.length - 1]) picks.push(informative[informative.length - 1]);
  const unique = Array.from(new Set(picks.map(s => s.trim())));
  const summary = unique.join(' ');
  return summary.substring(0, 800) + (summary.length > 800 ? '...' : '');
}

function generateQuizCards(lines: string[], sentences: string[], cleanedContent: string): Array<{ question: string; answer: string }> {
  const results: Array<{ question: string; answer: string }> = [];
  // Use the same extraction as flashcards first
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('?') && i + 1 < lines.length) {
      const q = line;
      const a = lines[i + 1].trim();
      if (a && !a.includes('?') && a.length > 3) {
        results.push({ question: q, answer: a });
        i++;
      }
    } else if (line.includes(':')) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const q = parts[0].trim();
        const a = parts.slice(1).join(':').trim();
        if (q.length > 2 && a.length > 3) results.push({ question: q.endsWith('?') ? q : q + '?', answer: a });
      }
    }
  }

  // Fallback to sentence pairs
  if (results.length === 0 && sentences.length > 1) {
    for (let i = 0; i < Math.min(sentences.length - 1, 20); i += 2) {
      const q = sentences[i];
      const a = sentences[i + 1] || '';
      if (q.length > 10 && a.length > 5) results.push({ question: q.endsWith('?') ? q : q + '?', answer: a });
    }
  }

  // Final fallback: one generic question
  if (results.length === 0) {
    results.push({
      question: 'What are the key points discussed?',
      answer: cleanedContent.substring(0, 200) + (cleanedContent.length > 200 ? '...' : '')
    });
  }
  return results;
}