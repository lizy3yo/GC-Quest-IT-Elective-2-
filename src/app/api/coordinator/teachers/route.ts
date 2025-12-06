import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import Class from '@/models/class';
import Assessment from '@/models/assessment';
import Flashcard from '@/models/flashcard';
import { Summary } from '@/models/summary';
import { cache, cacheKeys, CACHE_TTL, cacheTags } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = cacheKeys.coordinatorTeachers();
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: { teachers: cachedData },
        cached: true
      });
    }

    await connectToDatabase();

    // Get all teachers
    const teachers = await User.find({ role: 'teacher' }).lean();

    // Get stats for each teacher
    const teacherStats = await Promise.all(
      teachers.map(async (teacher: any) => {
        const teacherId = teacher._id.toString();
        
        const totalClasses = await Class.countDocuments({ teacherId });
        const assessments = await Assessment.find({ teacherId }).lean();
        
        const totalQuizzes = assessments.filter(a => a.category === 'Quiz').length;
        const totalExams = assessments.filter(a => a.category === 'Exam').length;
        const totalActivities = assessments.filter(a => a.category === 'Activity').length;
        
        // Flashcard model uses 'user' field, not 'teacherId'
        const totalFlashcards = await Flashcard.countDocuments({ user: teacherId });
        
        // Summary model uses 'userId' field, not 'teacherId'
        const totalSummaries = await Summary.countDocuments({ userId: teacherId });

        return {
          id: teacherId,
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
          totalClasses,
          totalQuizzes,
          totalExams,
          totalActivities,
          totalFlashcards,
          totalSummaries,
          archived: teacher.archived || false,
          archivedAt: teacher.archivedAt || null,
        };
      })
    );

    // Cache for 5 minutes
    cache.set(cacheKey, teacherStats, {
      ttl: CACHE_TTL.MEDIUM,
      tags: [cacheTags.coordinator]
    });

    return NextResponse.json({
      success: true,
      data: { teachers: teacherStats },
      cached: false
    });
  } catch (error) {
    console.error('Error fetching teacher stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teacher statistics' },
      { status: 500 }
    );
  }
}
