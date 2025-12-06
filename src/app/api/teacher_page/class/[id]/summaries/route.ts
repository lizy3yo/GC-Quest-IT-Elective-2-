import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { Summary } from '@/models/summary';
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

    console.log('[Summaries API] Fetching summaries for class:', classId);

    // Get class details to find the teacher and subject
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      console.log('[Summaries API] Class not found:', classId);
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    console.log('[Summaries API] Class found:', {
      classId: classDoc._id,
      teacherId: classDoc.teacherId,
      subject: classDoc.subject
    });

    // Fetch summaries created by the teacher for this subject
    // Filter by teacher's user ID and subject matching the class
    const query = {
      userId: classDoc.teacherId,
      subject: classDoc.subject,
      isPublic: true // Only show public/published summaries
    };
    
    console.log('[Summaries API] Query:', query);
    
    const summaries = await Summary.find(query).sort({ createdAt: -1 });
    
    console.log('[Summaries API] Found summaries:', summaries.length);

    return NextResponse.json({
      success: true,
      data: { summaries }
    });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch summaries' },
      { status: 500 }
    );
  }
}
