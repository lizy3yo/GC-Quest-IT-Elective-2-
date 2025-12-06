import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/jwt';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import Class from '@/models/class';
import Submission from '@/models/submission';
import { cache, CACHE_TTL, cacheTags } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Parent Overview API Called ===');
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
  
  let decoded;
    try {
      decoded = verifyAccessToken(token) as any;
    } catch (tokenError: any) {
      console.log('Token verification failed:', tokenError.message);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    if (!decoded || !decoded.userId) {
      console.log('No userId in token');
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    console.log('Token verified, userId:', decoded.userId);

    // Check cache first
    const cacheKey = `parent:overview:${decoded.userId}`;
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({ ...cachedData, cached: true });
    }

    await connectToDatabase();
    console.log('Database connected');

    // Get parent user
    const parent = await User.findById(decoded.userId);
    if (!parent) {
      console.log('Parent not found');
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('Parent found:', parent.email, 'Role:', parent.role);

    if (parent.role !== 'parent') {

      console.log('Not a parent account');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Parent access only' },
        { status: 403 }
      );
    }

    if (!parent.linkedStudentId) {
      console.log('No linked student');
      return NextResponse.json(
        { success: false, error: 'No student linked to this parent account' },
        { status: 404 }
      );
    }

    console.log('Linked student ID:', parent.linkedStudentId);

    // Get student
    const student = await User.findById(parent.linkedStudentId);
    if (!student) {
      console.log('Student not found');
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    console.log('Student found:', student.firstName, student.lastName);

    // Get classes - simplified
    let classes = [];
    try {
      const rawClasses = await Class.find({
        'students.studentId': student._id.toString(),
        'students.status': 'active',
        archived: { $ne: true }
      }).lean();
      
      console.log('Raw classes found:', rawClasses.length);

      // Manually populate teacher
      for (const cls of rawClasses) {
        const teacher = await User.findById(cls.teacherId);
        classes.push({
          ...cls,
          teacher: teacher ? {
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            email: teacher.email
          } : null
        });
      }
    } catch (err: any) {
      console.error('Error fetching classes:', err.message);
    }

    console.log('Classes processed:', classes.length);

    // Get all assessments to categorize submissions
    const Assessment = (await import('@/models/assessment')).default;
    const assessments = await Assessment.find({ published: true }).select('_id category').lean();
    const assessmentMap = new Map(assessments.map((a: any) => [a._id.toString(), a.category]));

    // Get submissions using studentId field (like leaderboards)
    let submissions: any[] = [];
    try {
      submissions = await Submission.find({
        studentId: student._id.toString(),
        status: { $in: ['submitted', 'late', 'graded'] }
      }).lean();
      console.log('Submissions found:', submissions.length);
    } catch (err: any) {
      console.error('Error fetching submissions:', err.message);
    }

    // Calculate stats like leaderboards
    const completedQuizzes = submissions.filter(s => {
      const category = assessmentMap.get(s.assessmentId?.toString());
      return category === 'Quiz';
    }).length;
    
    const completedExams = submissions.filter(s => {
      const category = assessmentMap.get(s.assessmentId?.toString());
      return category === 'Exam';
    }).length;
    
    const completedActivities = submissions.filter(s => {
      const category = assessmentMap.get(s.assessmentId?.toString());
      return category === 'Activity';
    }).length;

    const totalScore = submissions.reduce((sum, s) => sum + (s.score || 0), 0);
    
    // Calculate average as percentage (like leaderboards)
    const averageScore = submissions.length > 0
      ? Math.round(submissions.reduce((sum, s) => {
          const percentage = s.maxScore ? (s.score / s.maxScore * 100) : 0;
          return sum + percentage;
        }, 0) / submissions.length)
      : 0;

    console.log('Stats calculated - Avg:', averageScore, 'Total:', totalScore);

    const response = {
      success: true,
      data: {
        student: {
          id: student._id.toString(),
          name: `${student.firstName} ${student.lastName}`,
          email: student.email,
          studentNumber: student.studentNumber || '',
          profileImage: student.profileImage
        },
        classes: classes.map((cls: any) => ({
          id: cls._id.toString(),
          name: cls.name,
          classCode: cls.classCode,
          teacher: cls.teacher ? {
            name: `${cls.teacher.firstName} ${cls.teacher.lastName}`,
            email: cls.teacher.email
          } : { name: 'Unknown', email: '' },
          courseYear: cls.courseYear || ''
        })),
        activity: {
          totalClasses: classes.length,
          completedQuizzes,
          completedExams,
          completedActivities,
          averageScore,
          totalPoints: totalScore,
          recentActivity: submissions.slice(0, 10).map(sub => ({
            id: sub._id.toString(),
            title: 'Assessment',
            type: assessmentMap.get(sub.assessmentId?.toString()) || 'quiz',
            score: sub.score || 0,
            totalPoints: sub.maxScore || 0,
            percentage: sub.maxScore ? Math.round((sub.score / sub.maxScore) * 100) : 0,
            submittedAt: sub.submittedAt,
            className: 'Class'
          }))
        }
      }
    };

    // Cache for 2 minutes
    cache.set(cacheKey, response, {
      ttl: CACHE_TTL.SHORT * 4, // 2 minutes
      tags: [cacheTags.user(decoded.userId)]
    });

    console.log('Sending response');
    console.log('===================================');
    return NextResponse.json({ ...response, cached: false });

  } catch (error: any) {
    console.error('=== FATAL ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('===================');
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
