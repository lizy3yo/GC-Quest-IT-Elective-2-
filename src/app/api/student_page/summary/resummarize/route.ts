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
    const summaryId = searchParams.get('summaryId');

    if (!userId || !summaryId) {
      return NextResponse.json({ success: false, error: 'User ID and Summary ID are required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({} as any));
    // Allow caller to override summaryType / maxLength or provide source content
    const { summaryType, maxLength, content: overrideContent } = body || {};

    const existing = await Summary.findOne({ _id: summaryId, userId });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Summary not found' }, { status: 404 });
    }

    // Determine source content to summarize. Prefer explicit content in the request.
    // If not provided, fall back to the original summary.content (best-effort when original source isn't stored).
    const sourceContent = (typeof overrideContent === 'string' && overrideContent.trim().length > 0)
      ? overrideContent.trim()
      : existing.content;

    if (!sourceContent || sourceContent.length < 50) {
      return NextResponse.json({ success: false, error: 'Source content is too short to resummarize' }, { status: 400 });
    }

    const generator = new InternalSummaryGenerator();
    const result = await generator.generateSummary({
      content: sourceContent,
      title: existing.title || 'Resummarized',
      subject: existing.subject,
      summaryType: summaryType || existing.summaryType,
      maxLength: maxLength || 300
    });

    // Update existing summary with new generated content
    existing.title = result.summary.title;
    existing.content = result.summary.content;
    existing.keyPoints = result.summary.keyPoints || [];
    existing.mainTopics = result.summary.mainTopics || [];
    existing.wordCount = result.summary.wordCount || existing.wordCount;
    existing.readingTime = result.summary.readingTime || existing.readingTime;
    existing.difficulty = result.summary.difficulty || existing.difficulty;
    existing.subject = result.summary.subject || existing.subject;
    existing.summaryType = result.summary.summaryType || existing.summaryType;
    existing.tags = result.summary.tags || existing.tags;
    existing.confidence = result.summary.confidence ?? existing.confidence;
    // If we re-used existing content as source, keep originalWordCount; else update if generator provided it
    if (result.originalWordCount) existing.originalWordCount = result.originalWordCount;
    if (result.compressionRatio) existing.compressionRatio = result.compressionRatio;

    const saved = await existing.save();

    logger.info('Summary resummarized and updated successfully', { summaryId, userId });

    await logActivity({
      userId: String(userId),
      type: 'summary.resummarize',
      action: 'resummarized',
      meta: { summaryId: String(summaryId), title: saved.title },
      progress: 100
    });

    return NextResponse.json({ success: true, message: 'Summary resummarized successfully', summary: saved });

  } catch (error) {
    logger.error('Summary resummarize failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ success: false, error: 'Failed to resummarize summary' }, { status: 500 });
  }
}
