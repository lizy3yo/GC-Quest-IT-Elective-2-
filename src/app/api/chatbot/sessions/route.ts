import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import ChatSession from '@/models/chatSession';
import { verifyToken } from '@/lib/jwt';

// GET - List all sessions for a user
export async function GET(request: NextRequest) {
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

    const sessions = await ChatSession.find({ userId: decoded.userId })
      .select('_id title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST - Save a new session
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token) as { userId: string };
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { title, messages } = await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Cannot save empty chat' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const session = await ChatSession.create({
      userId: decoded.userId,
      title: title || `Chat ${new Date().toLocaleDateString()}`,
      messages
    });

    return NextResponse.json({
      success: true,
      sessionId: session._id,
      message: 'Chat session saved successfully'
    });
  } catch (error) {
    console.error('Error saving chat session:', error);
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 }
    );
  }
}
