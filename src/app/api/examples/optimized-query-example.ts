/**
 * Example API Route with MongoDB Optimizations
 * 
 * This file demonstrates how to use the optimization utilities
 * in your API routes for maximum performance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import {
  optimizeQuery,
  paginatedQuery,
  batchFindByIds,
  measureQuery,
  QueryPatterns,
  DEFAULT_LIMITS,
} from '@/lib/db-optimization';
import User from '@/models/user';
import Class from '@/models/class';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';

/**
 * Example 1: Basic Optimized Query
 */
export async function getStudents(teacherId: string) {
  await connectToDatabase();

  // ❌ BAD: No optimization
  // const students = await User.find({ role: 'student' });

  // ✅ GOOD: Optimized query
  const students = await optimizeQuery(
    User.find({ role: 'student', archived: { $ne: true } }),
    {
      limit: DEFAULT_LIMITS.LIST,
      sort: { createdAt: -1 },
      select: 'firstName lastName email studentNumber',
      lean: true, // Returns plain objects (faster)
    }
  );

  return students;
}

/**
 * Example 2: Paginated Query
 */
export async function getTeacherClasses(
  teacherId: string,
  page: number = 1,
  limit: number = 20
) {
  await connectToDatabase();

  // ✅ Paginated query with automatic optimization
  const result = await paginatedQuery(
    Class,
    { teacherId, isActive: true },
    {
      page,
      limit,
      sort: { createdAt: -1 },
      select: 'name subject courseYear students',
    }
  );

  return result;
  // Returns: {
  //   data: [...],
  //   pagination: {
  //     page: 1,
  //     limit: 20,
  //     total: 45,
  //     totalPages: 3,
  //     hasNext: true,
  //     hasPrev: false
  //   }
  // }
}

/**
 * Example 3: Batch Operations
 */
export async function getStudentDetails(studentIds: string[]) {
  await connectToDatabase();

  // ❌ BAD: N database queries
  // const students = [];
  // for (const id of studentIds) {
  //   const student = await User.findById(id);
  //   students.push(student);
  // }

  // ✅ GOOD: Single batch query
  const students = await batchFindByIds(User, studentIds, {
    select: 'firstName lastName email profileImage',
  });

  return students;
}

/**
 * Example 4: Complex Query with Monitoring
 */
export async function getTeacherDashboard(teacherId: string) {
  await connectToDatabase();

  // Measure query performance
  const dashboardData = await measureQuery('Teacher Dashboard', async () => {
    // Fetch all data in parallel
    const [classes, recentSubmissions, pendingGrading] = await Promise.all([
      // Get teacher's classes
      optimizeQuery(
        Class.find({ teacherId, isActive: true }),
        {
          limit: 10,
          sort: { createdAt: -1 },
          select: 'name subject students',
        }
      ),

      // Get recent submissions
      optimizeQuery(
        Submission.find({ gradedBy: teacherId })
          .sort({ gradedAt: -1 }),
        {
          limit: 20,
          select: 'studentId assessmentId score submittedAt',
        }
      ),

      // Get pending grading
      optimizeQuery(
        Submission.find({
          status: 'submitted',
          needsManualGrading: true,
        }),
        {
          limit: 50,
          sort: { submittedAt: 1 },
          select: 'studentId assessmentId submittedAt',
        }
      ),
    ]);

    return {
      classes,
      recentSubmissions,
      pendingGrading,
    };
  });

  return dashboardData;
}

/**
 * Example 5: Using Query Patterns
 */
export async function getUserRecentFlashcards(userId: string) {
  await connectToDatabase();

  // Use pre-built query pattern
  const recentFlashcards = await QueryPatterns.findRecent(
    require('@/models/flashcard').default,
    userId,
    20
  );

  return recentFlashcards;
}

/**
 * Example 6: Aggregation with Optimization
 */
export async function getClassStatistics(classId: string) {
  await connectToDatabase();

  const stats = await measureQuery('Class Statistics', async () => {
    // Get assessments for this class
    const assessments = await optimizeQuery(
      Assessment.find({ classId, published: true }),
      {
        select: '_id title category',
      }
    );

    const assessmentIds = assessments.map((a: any) => a._id.toString());

    // Get submission statistics
    const submissions = await optimizeQuery(
      Submission.find({
        assessmentId: { $in: assessmentIds },
        status: 'graded',
      }),
      {
        select: 'studentId score maxScore',
      }
    );

    // Calculate statistics
    const totalSubmissions = submissions.length;
    const averageScore =
      submissions.reduce((sum: number, s: any) => {
        return sum + (s.score / s.maxScore) * 100;
      }, 0) / totalSubmissions;

    return {
      totalAssessments: assessments.length,
      totalSubmissions,
      averageScore: Math.round(averageScore),
    };
  });

  return stats;
}

/**
 * Example 7: Full API Route Implementation
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const teacherId = searchParams.get('teacherId');

    if (!teacherId) {
      return NextResponse.json(
        { error: 'Teacher ID is required' },
        { status: 400 }
      );
    }

    // Use paginated query
    const result = await paginatedQuery(
      Class,
      { teacherId, isActive: true },
      {
        page,
        limit,
        sort: { createdAt: -1 },
        select: 'name subject courseYear students createdAt',
      }
    );

    // Fetch teacher details
    const teacher = await optimizeQuery(
      User.findById(teacherId),
      {
        select: 'firstName lastName email',
      }
    );

    return NextResponse.json({
      success: true,
      teacher,
      classes: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Example 8: Verify Index Usage (Development Only)
 */
export async function verifyQueryIndexes() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  await connectToDatabase();

  const { verifyIndexUsage } = await import('@/lib/db-optimization');

  // Test common queries
  const queries = [
    {
      name: 'Find user by email',
      query: User.find({ email: 'test@example.com' }),
    },
    {
      name: 'Find teacher classes',
      query: Class.find({ teacherId: 'test-id', isActive: true }),
    },
    {
      name: 'Find published assessments',
      query: Assessment.find({ classId: 'test-id', published: true }),
    },
  ];

  for (const { name, query } of queries) {
    const result = await verifyIndexUsage(query);
    console.log(`${name}:`, result);
  }
}

/**
 * Best Practices Summary:
 * 
 * 1. ✅ Always use connectToDatabase() at the start
 * 2. ✅ Use optimizeQuery() for all find operations
 * 3. ✅ Use paginatedQuery() for list endpoints
 * 4. ✅ Use batchFindByIds() instead of loops
 * 5. ✅ Use measureQuery() for important operations
 * 6. ✅ Always apply .limit() to prevent unbounded queries
 * 7. ✅ Use .select() to fetch only needed fields
 * 8. ✅ Use .lean() for read-only operations
 * 9. ✅ Fetch related data in parallel with Promise.all()
 * 10. ✅ Monitor slow queries in production logs
 */
