import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { Summary } from '@/models/summary';
import { authenticate } from '@/lib/middleware/authenticate';

// PATCH - Update summary (rename or edit content)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    await connectToDatabase();
    const { id: summaryId } = await params;

    const body = await request.json();
    const { title, content, keyPoints, mainTopics } = body;

    // If only title is provided (rename operation), require it
    if (title !== undefined && !content && !keyPoints && !mainTopics) {
      if (!title || !title.trim()) {
        return NextResponse.json(
          { success: false, error: 'Title is required' },
          { status: 400 }
        );
      }
    }

    const summary = await Summary.findById(summaryId);
    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Summary not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (summary.userId !== authResult.userId.toString()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update fields if provided
    if (title !== undefined && title.trim()) {
      summary.title = title.trim();
    }
    if (content !== undefined) {
      summary.content = content;
      // Recalculate word count if content changed
      summary.wordCount = content.split(/\s+/).filter((word: string) => word.length > 0).length;
    }
    if (keyPoints !== undefined) {
      summary.keyPoints = keyPoints;
    }
    if (mainTopics !== undefined) {
      summary.mainTopics = mainTopics;
    }
    
    summary.updatedAt = new Date();
    await summary.save();

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          _id: summary._id,
          title: summary.title,
          content: summary.content,
          keyPoints: summary.keyPoints,
          mainTopics: summary.mainTopics,
          wordCount: summary.wordCount,
          updatedAt: summary.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Error updating summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update summary' },
      { status: 500 }
    );
  }
}

// DELETE - Delete summary
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    await connectToDatabase();
    const { id: summaryId } = await params;

    const summary = await Summary.findById(summaryId);
    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Summary not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (summary.userId !== authResult.userId.toString()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await Summary.findByIdAndDelete(summaryId);

    return NextResponse.json({
      success: true,
      message: 'Summary deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete summary' },
      { status: 500 }
    );
  }
}
