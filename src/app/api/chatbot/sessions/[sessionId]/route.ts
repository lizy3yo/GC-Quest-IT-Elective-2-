import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import ChatSession from '@/models/chatSession';
import { verifyToken } from '@/lib/jwt';

// GET - Load a specific session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token) as { userId: string };
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    await connectToDatabase();

    const { sessionId } = await params;

    const session = await ChatSession.findOne({
      _id: sessionId,
      userId: decoded.userId
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error loading chat session:', error);
    return NextResponse.json(
      { error: 'Failed to load session' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token) as { userId: string };
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    await connectToDatabase();

    const { sessionId } = await params;

    const result = await ChatSession.deleteOne({
      _id: sessionId,
      userId: decoded.userId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
