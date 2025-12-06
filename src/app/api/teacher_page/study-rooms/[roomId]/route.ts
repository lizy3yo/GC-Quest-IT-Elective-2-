import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import StudyRoom from '@/models/study-room';
import { logger } from '@/lib/winston';

export const dynamic = 'force-dynamic';

// GET - Fetch a specific study room with full details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    await connectToDatabase();

    const { roomId } = await context.params;

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Room ID is required' },
        { status: 400 }
      );
    }

    const room = await StudyRoom.findById(roomId)
      .populate('createdBy', 'firstName lastName email')
      .populate('members', 'firstName lastName email')
      .populate('messages.userId', 'firstName lastName')
      .populate('notes.userId', 'firstName lastName')
      .lean();

    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Study room not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      room
    });

  } catch (error: any) {
    logger.error('Error fetching study room details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch study room details' },
      { status: 500 }
    );
  }
}
