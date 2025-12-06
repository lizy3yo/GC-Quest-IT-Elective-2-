import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import Class from '@/models/class';
import Submission from '@/models/submission';
import Assessment from '@/models/assessment';
import { cache, cacheKeys, CACHE_TTL, cacheTags } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = cacheKeys.coordinatorStudents();
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: { students: cachedData },
        cached: true
      });
    }

    await connectToDatabase();

    // Get all students
    const students = await User.find({ role: 'student' }).lean();

    // Get stats for each student
    const studentStats = await Promise.all(
      students.map(async (student: any) => {
        const studentId = student._id.toString();
        
        // Get enrolled classes
        const classes = await Class.find({ 
          students: { $elemMatch: { studentId } }
        }).lean();
        
        const totalClasses = classes.length;
        
        // Get submissions
        const submissions = await Submission.find({ studentId }).lean();
        
        // Get assessment IDs from submissions
        const assessmentIds = submissions.map(s => s.assessmentId);
        
        // Fetch assessments to get their categories
        const assessments = await Assessment.find({ 
          _id: { $in: assessmentIds } 
        }).select('_id category').lean();
        
        // Create a map of assessmentId to category
        const assessmentCategoryMap = new Map(
          assessments.map((a: any) => [a._id.toString(), a.category])
        );
        
        // Count submissions by category
        const completedQuizzes = submissions.filter(s => 
          assessmentCategoryMap.get(s.assessmentId) === 'Quiz'
        ).length;
        
        const completedExams = submissions.filter(s => 
          assessmentCategoryMap.get(s.assessmentId) === 'Exam'
        ).length;
        
        const completedActivities = submissions.filter(s => 
          assessmentCategoryMap.get(s.assessmentId) === 'Activity'
        ).length;
        
        // Calculate average score (as percentage)
        const gradedSubmissions = submissions.filter(s => 
          s.score !== undefined && 
          s.score !== null && 
          s.maxScore !== undefined && 
          s.maxScore !== null &&
          s.maxScore > 0
        );
        
        const averageScore = gradedSubmissions.length > 0
          ? gradedSubmissions.reduce((sum, s) => {
              const percentage = (s.score! / s.maxScore!) * 100;
              return sum + percentage;
            }, 0) / gradedSubmissions.length
          : 0;

        // Generate student number if not exists (for demo purposes)
        const currentYear = new Date().getFullYear();
        const studentNumber = student.username.match(/^\d{9}$/) 
          ? student.username 
          : `${currentYear}${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

        return {
          id: studentId,
          name: `${student.firstName} ${student.lastName}`,
          email: student.email,
          studentNumber,
          totalClasses,
          completedQuizzes,
          completedExams,
          completedActivities,
          studiedFlashcards: 0, // TODO: Implement flashcard tracking
          viewedSummaries: 0, // TODO: Implement summary tracking
          averageScore,
          archived: student.archived || false,
          archivedAt: student.archivedAt || null,
        };
      })
    );

    // Cache for 5 minutes
    cache.set(cacheKey, studentStats, {
      ttl: CACHE_TTL.MEDIUM,
      tags: [cacheTags.coordinator]
    });

    return NextResponse.json({
      success: true,
      data: { students: studentStats },
      cached: false
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch student statistics' },
      { status: 500 }
    );
  }
}
