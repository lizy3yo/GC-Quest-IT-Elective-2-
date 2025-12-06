import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Class from '@/models/class';
import User from '@/models/user';
import { cache, CACHE_TTL, cacheTags } from '@/lib/cache';

// GET - Fetch all classes
export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = 'coordinator:classes';
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: { classes: cachedData },
        cached: true
      });
    }

    await connectToDatabase();

    const classes = await Class.find().sort({ createdAt: -1 }).lean();

    // Enrich with teacher information
    const enrichedClasses = await Promise.all(
      classes.map(async (classItem: any) => {
        const teacher = await User.findById(classItem.teacherId).select('firstName lastName email').lean();
        
        return {
          id: classItem._id.toString(),
          name: classItem.name,
          subject: classItem.subject,
          courseYear: classItem.courseYear,
          description: classItem.description,
          classCode: classItem.classCode,
          isActive: classItem.isActive,
          teacher: teacher ? {
            id: teacher._id.toString(),
            name: `${teacher.firstName} ${teacher.lastName}`,
            email: teacher.email
          } : null,
          studentCount: classItem.students.filter((s: any) => s.status === 'active').length,
          day: classItem.day,
          time: classItem.time,
          room: classItem.room,
          createdAt: classItem.createdAt,
          archived: classItem.archived || false,
          archivedAt: classItem.archivedAt || null,
        };
      })
    );

    // Cache for 5 minutes
    cache.set(cacheKey, enrichedClasses, {
      ttl: CACHE_TTL.MEDIUM,
      tags: [cacheTags.coordinator]
    });

    return NextResponse.json({
      success: true,
      data: { classes: enrichedClasses },
      cached: false
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch classes' },
      { status: 500 }
    );
  }
}

// POST - Create a new class
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { name, classCode, courseYear, description, teacherId, day, time, room } = body;

    // Validate required fields
    if (!name || !classCode || !courseYear || !teacherId) {
      return NextResponse.json(
        { success: false, error: 'Name, class code, course year, and teacher are required' },
        { status: 400 }
      );
    }

    // Verify teacher exists
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return NextResponse.json(
        { success: false, error: 'Invalid teacher selected' },
        { status: 400 }
      );
    }

    // Check if this class code already exists
    const existingClass = await Class.findOne({ classCode });
    if (existingClass) {
      return NextResponse.json(
        { success: false, error: 'A class with this code already exists. Please use a different class code.' },
        { status: 409 }
      );
    }

    // Create new class
    const newClass = new Class({
      name,
      subject: name, // Use name as subject
      courseYear,
      description,
      teacherId,
      classCode,
      day: day || [],
      time: time || '',
      room: room || '',
      isActive: true,
      students: [],
      groups: [],
      announcements: [],
      resources: [],
      posts: [],
      settings: {
        allowStudentPosts: true,
        moderateStudentPosts: false,
        allowLateSubmissions: true,
        notifyOnNewStudent: true
      }
    });

    await newClass.save();

    // Invalidate coordinator cache
    cache.invalidateByTag(cacheTags.coordinator);

    return NextResponse.json({
      success: true,
      data: {
        id: newClass._id.toString(),
        name: newClass.name,
        subject: newClass.subject,
        courseYear: newClass.courseYear,
        classCode: newClass.classCode,
        teacher: {
          id: teacher._id.toString(),
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email
        }
      }
    });
  } catch (error: any) {
    console.error('Error creating class:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create class' },
      { status: 500 }
    );
  }
}


