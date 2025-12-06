import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import StudyRoom from '@/models/study-room';
import Class from '@/models/class';
import { logger } from '@/lib/winston';
import { cache, CACHE_TTL, cacheTags } from '@/lib/cache';

export const dynamic = 'force-dynamic';

// GET - Fetch study rooms for subjects the teacher handles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');

    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: 'Teacher ID is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `teacher:study-rooms:${teacherId}`;
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({ ...cachedData, cached: true });
    }

    await connectToDatabase();

    // Get all classes/subjects the teacher handles
    // The Class model uses 'teacherId' field (string)
    const teacherClasses = await Class.find({ teacherId: teacherId, isActive: true }).lean();
    
    console.log('Teacher ID:', teacherId);
    console.log('Teacher classes found:', teacherClasses.length);
    console.log('Classes:', teacherClasses.map((c: any) => ({ name: c.name, subject: c.subject })));
    
    const teacherSubjects = [...new Set(teacherClasses.map((cls: any) => cls.subject).filter(Boolean))];

    if (teacherSubjects.length === 0) {
      return NextResponse.json({
        success: true,
        rooms: [],
        subjects: [],
        message: 'No classes found for this teacher'
      });
    }

    console.log('Teacher subjects:', teacherSubjects);

    // Fetch all study rooms that match the teacher's subjects (case-insensitive)
    // Create regex patterns for case-insensitive matching
    const subjectPatterns = teacherSubjects.map(subject => {
      // Escape special regex characters in subject name
      const escaped = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`^${escaped}$`, 'i');
    });
    
    const rooms = await StudyRoom.find({
      $or: subjectPatterns.map(pattern => ({ subject: pattern }))
    })
      .populate('createdBy', 'firstName lastName email')
      .populate('members', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();
    
    console.log('Study rooms found:', rooms.length);
    if (rooms.length > 0) {
      console.log('Room subjects:', rooms.map((r: any) => r.subject));
    }

    // Add active member count
    const roomsWithStats = rooms.map((room: any) => ({
      ...room,
      activeMembers: room.members?.length || 0,
      memberDetails: room.members || []
    }));

    const responseData = {
      success: true,
      rooms: roomsWithStats,
      subjects: teacherSubjects
    };

    // Cache for 2 minutes
    cache.set(cacheKey, responseData, {
      ttl: CACHE_TTL.SHORT * 4,
      tags: [cacheTags.user(teacherId)]
    });

    return NextResponse.json({ ...responseData, cached: false });

  } catch (error: any) {
    logger.error('Error fetching teacher study rooms:', error);
    console.error('Error fetching teacher study rooms:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch study rooms' },
      { status: 500 }
    );
  }
}
