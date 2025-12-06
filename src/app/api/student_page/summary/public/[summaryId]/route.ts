import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { Summary } from '@/models/summary';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ summaryId: string }> }
) {
  try {
    await connectToDatabase();
    const { summaryId } = await params;

    // Find the summary - must be public
    const summary = await Summary.findOne({
      _id: summaryId,
      isPublic: true
    });

    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Summary not found or not public' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      summary: {
        _id: summary._id,
        title: summary.title,
        content: summary.content,
        subject: summary.subject,
        createdAt: summary.createdAt,
        wordCount: summary.wordCount,
        difficulty: summary.difficulty,
        summaryType: summary.summaryType,
        keyPoints: summary.keyPoints,
        mainTopics: summary.mainTopics,
        compressionRatio: summary.compressionRatio,
        readingTime: summary.readingTime,
        confidence: summary.confidence
      }
    });
  } catch (error) {
    console.error('Error fetching public summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}
