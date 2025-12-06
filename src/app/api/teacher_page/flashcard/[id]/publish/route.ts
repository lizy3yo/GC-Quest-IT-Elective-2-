import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Flashcard from '@/models/flashcard';
import { authenticate } from '@/lib/middleware/authenticate';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    await connectToDatabase();
    const { id: flashcardId } = await params;

    // Parse request body
    const body = await request.json();
    const { publish } = body;

    // Find the flashcard
    const flashcard = await Flashcard.findById(flashcardId);
    if (!flashcard) {
      return NextResponse.json(
        { success: false, error: 'Flashcard not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (flashcard.user.toString() !== authResult.userId.toString()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update publish status
    flashcard.accessType = publish ? 'public' : 'private';
    await flashcard.save();

    return NextResponse.json({
      success: true,
      data: {
        flashcard: {
          _id: flashcard._id,
          accessType: flashcard.accessType
        }
      }
    });
  } catch (error) {
    console.error('Error updating flashcard publish status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update publish status' },
      { status: 500 }
    );
  }
}
