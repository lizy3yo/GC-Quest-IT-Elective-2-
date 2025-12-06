import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';

export const dynamic = 'force-dynamic';
import { Summary } from '@/models/summary';
import { logger } from '@/lib/winston';
import { logActivity } from '@/lib/activity';

// GET - Fetch summaries for a user or a specific summary by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const summaryId = searchParams.get('summaryId');
    const subject = searchParams.get('subject');
    const isPublic = searchParams.get('isPublic');
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    await connectToDatabase();

    // If summaryId is provided, fetch a specific summary
    if (summaryId) {
      const summary = await Summary.findOne({
        _id: summaryId,
        userId
      });

      if (!summary) {
        return NextResponse.json({
          success: false,
          error: 'Summary not found'
        }, { status: 404 });
      }

      logger.info('Single summary fetched successfully', {
        summaryId,
        userId,
        title: summary.title
      });

      return NextResponse.json({
        success: true,
        summary
      });
    }

    // Otherwise, fetch all summaries for the user
    // Build query
    const query: any = { userId };
    
    if (subject && subject !== 'all') {
      query.subject = subject;
    }
    
    // Only filter by isPublic if explicitly provided
    if (isPublic !== null && isPublic !== undefined) {
      query.isPublic = isPublic === 'true';
    }

    const summaries = await Summary.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    logger.info('Summaries fetched successfully', {
      userId,
      count: summaries.length,
      subject,
      isPublic
    });

    return NextResponse.json({
      success: true,
      summaries
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    logger.error('Failed to fetch summaries:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch summaries'
    }, { status: 500 });
  }
}

// DELETE - Delete a summary
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const summaryId = searchParams.get('summaryId');
    
    if (!userId || !summaryId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID and Summary ID are required' 
      }, { status: 400 });
    }

    // Find and delete the summary (only if it belongs to the user)
    const deletedSummary = await Summary.findOneAndDelete({
      _id: summaryId,
      userId
    });

    if (!deletedSummary) {
      return NextResponse.json({
        success: false,
        error: 'Summary not found or you do not have permission to delete it'
      }, { status: 404 });
    }

    logger.info('Summary deleted successfully', {
      summaryId,
      userId,
      title: deletedSummary.title
    });

    // Log activity
    await logActivity({
      userId: String(userId),
      type: 'summary.delete',
      action: 'deleted',
      meta: {
        summaryId: String(summaryId),
        title: deletedSummary.title
      },
      progress: 100
    });

    return NextResponse.json({
      success: true,
      message: 'Summary deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete summary:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to delete summary'
    }, { status: 500 });
  }
}

// PATCH - Update a summary
export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const summaryId = searchParams.get('summaryId');
    
    if (!userId || !summaryId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID and Summary ID are required' 
      }, { status: 400 });
    }

    const body = await request.json();
    const { title, subject, tags, isPublic, folder, isFavorite, content, keyPoints, mainTopics, isRead } = body;

    // Build update object
    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (subject !== undefined) updateData.subject = subject.trim();
    if (tags !== undefined) updateData.tags = tags;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (folder !== undefined) updateData.folder = folder;
    if (content !== undefined) updateData.content = content;
    if (keyPoints !== undefined) updateData.keyPoints = keyPoints;
    if (mainTopics !== undefined) updateData.mainTopics = mainTopics;
    
    // Handle isFavorite with timestamp
    if (isFavorite !== undefined) {
      updateData.isFavorite = isFavorite;
      updateData.favoritedAt = isFavorite ? new Date() : null;
    }
    
    // Handle isRead with timestamp
    if (isRead !== undefined) {
      updateData.isRead = isRead;
      updateData.lastReadAt = isRead ? new Date() : null;
    }
    
    // Update timestamp
    updateData.updatedAt = new Date();

    // Update the summary (only if it belongs to the user)
    const updatedSummary = await Summary.findOneAndUpdate(
      { _id: summaryId, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedSummary) {
      return NextResponse.json({
        success: false,
        error: 'Summary not found or you do not have permission to update it'
      }, { status: 404 });
    }

    logger.info('Summary updated successfully', {
      summaryId,
      userId,
      updatedFields: Object.keys(updateData)
    });

    // Log activity
    await logActivity({
      userId: String(userId),
      type: 'summary.update',
      action: 'updated',
      meta: {
        summaryId: String(summaryId),
        title: updatedSummary.title,
        updatedFields: Object.keys(updateData)
      },
      progress: 100
    });

    return NextResponse.json({
      success: true,
      message: 'Summary updated successfully',
      summary: updatedSummary
    });

  } catch (error) {
    logger.error('Failed to update summary:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to update summary'
    }, { status: 500 });
  }
}