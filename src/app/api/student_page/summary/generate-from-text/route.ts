import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { Summary } from '@/models/summary';
import { InternalSummaryGenerator } from '@/lib/ai/internal-summary-generator';
import { logger } from '@/lib/winston';
import { logActivity } from '@/lib/activity';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    const body = await request.json();
    const { content, title, subject, summaryType, maxLength, isPublic } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: 'Content is required' 
      }, { status: 400 });
    }

    if (content.trim().length < 100) {
      return NextResponse.json({ 
        success: false, 
        error: 'Content must be at least 100 characters long' 
      }, { status: 400 });
    }

    if (content.length > 100000) {
      return NextResponse.json({ 
        success: false, 
        error: 'Content too long. Please limit to 100,000 characters' 
      }, { status: 400 });
    }

    logger.info('Processing text for summary generation', {
      userId,
      contentLength: content.length,
      summaryType: summaryType || 'detailed',
      subject: subject || 'General'
    });

    // Generate summary using AI
    const generator = new InternalSummaryGenerator();
    const result = await generator.generateSummary({
      content: content.trim(),
      title: title?.trim() || 'Text Summary',
      subject: subject?.trim(),
      summaryType: summaryType as any,
      maxLength: maxLength || 300  // Reduced default for more concise summaries
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
      isPublic: isPublic === true
    });

    const savedSummary = await summaryDoc.save();

    logger.info('Summary generated from text and saved successfully', {
      summaryId: savedSummary._id,
      userId,
      wordCount: result.summary.wordCount,
      compressionRatio: result.compressionRatio
    });

    // Log activity
    await logActivity({
      userId: String(userId),
      type: 'summary.generate',
      action: 'generated from text',
      meta: {
        summaryId: String(savedSummary._id),
        title: savedSummary.title,
        wordCount: savedSummary.wordCount,
        subject: savedSummary.subject
      },
      progress: 100
    });

    return NextResponse.json({
      success: true,
      message: 'Summary generated successfully from text!',
      summary: {
        id: savedSummary._id,
        title: savedSummary.title,
        wordCount: savedSummary.wordCount,
        compressionRatio: savedSummary.compressionRatio,
        processingTime: result.processingTime,
        qualityScore: result.qualityScore
      }
    });

  } catch (error) {
    logger.error('Text summary generation failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate summary from text'
    }, { status: 500 });
  }
}