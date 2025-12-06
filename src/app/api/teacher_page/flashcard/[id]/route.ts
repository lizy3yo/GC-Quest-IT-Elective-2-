import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Flashcard from '@/models/flashcard';
import { authenticate } from '@/lib/middleware/authenticate';

// PATCH - Update flashcard (rename)
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
    const { id: flashcardId } = await params;

    const body = await request.json();
    const { title } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

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

    flashcard.title = title.trim();
    flashcard.updatedAt = new Date();
    await flashcard.save();

    return NextResponse.json({
      success: true,
      data: {
        flashcard: {
          _id: flashcard._id,
          title: flashcard.title,
          updatedAt: flashcard.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Error updating flashcard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update flashcard' },
      { status: 500 }
    );
  }
}

// DELETE - Delete flashcard
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
    const { id: flashcardId } = await params;

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

    await Flashcard.findByIdAndDelete(flashcardId);

    return NextResponse.json({
      success: true,
      message: 'Flashcard deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting flashcard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete flashcard' },
      { status: 500 }
    );
  }
}
