import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Flashcard from '@/models/flashcard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flashcardId: string }> }
) {
  try {
    await connectToDatabase();
    const { flashcardId } = await params;

    // Find the flashcard - must be public
    const flashcard = await Flashcard.findOne({
      _id: flashcardId,
      accessType: 'public'
    });

    if (!flashcard) {
      return NextResponse.json(
        { success: false, message: 'Flashcard not found or not public' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      flashcard: {
        _id: flashcard._id,
        title: flashcard.title,
        description: flashcard.description,
        cards: flashcard.cards,
        tags: flashcard.tags,
        difficulty: flashcard.difficulty,
        subject: flashcard.subject,
        createdAt: flashcard.createdAt,
        accessType: flashcard.accessType
      }
    });
  } catch (error) {
    console.error('Error fetching public flashcard:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch flashcard' },
      { status: 500 }
    );
  }
}
