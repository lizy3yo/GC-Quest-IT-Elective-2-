import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Flashcard from '@/models/flashcard';
import Class from '@/models/class';
import { authenticate } from '@/lib/middleware/authenticate';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { id: classId } = await params;

    await connectToDatabase();

    console.log('[Flashcards API] Fetching flashcards for class:', classId);

    // Get class details to find the teacher and subject
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      console.log('[Flashcards API] Class not found:', classId);
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    console.log('[Flashcards API] Class found:', {
      classId: classDoc._id,
      teacherId: classDoc.teacherId,
      subject: classDoc.subject
    });

    // Fetch flashcards created by the teacher for this subject
    // Filter by teacher's user ID and subject matching the class
    const query = {
      user: classDoc.teacherId,
      subject: classDoc.subject,
      accessType: 'public' // Only show public/published flashcards
    };
    
    console.log('[Flashcards API] Query:', query);
    
    const flashcards = await Flashcard.find(query).sort({ createdAt: -1 });
    
    console.log('[Flashcards API] Found flashcards:', flashcards.length);

    return NextResponse.json({
      success: true,
      data: { flashcards }
    });
  } catch (error) {
    console.error('Error fetching flashcards:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch flashcards' },
      { status: 500 }
    );
  }
}
