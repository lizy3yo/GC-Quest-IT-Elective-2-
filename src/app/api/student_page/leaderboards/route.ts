import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { connectToDatabase } from '@/lib/mongoose';
import Class from '@/models/class';
import Submission from '@/models/submission';
import Assessment from '@/models/assessment';
import User from '@/models/user';
import { cache, cacheKeys, CACHE_TTL, cacheTags } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'overall';
    const sortBy = searchParams.get('sortBy') || 'points';

    // Check cache first
    const cacheKey = cacheKeys.studentLeaderboard(view, sortBy);
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        students: cachedData,
        cached: true
      });
    }

    // Get all classes the student is enrolled in
    const classes = await Class.find({
      'students.studentId': user._id.toString(),
      'students.status': 'active'
    }).lean();

    const classIds = classes.map(c => c._id);

    if (classIds.length === 0) {
      return NextResponse.json({
        success: true,
        students: []
      });
    }

    // Get all students from the same classes (peers)
    const allStudentIds = new Set<string>();
    classes.forEach(cls => {
      if (cls.students && Array.isArray(cls.students)) {
        cls.students.forEach((student: any) => {
          const studentId = student.studentId || student;
          if (student.status === 'active' || !student.status) {
            allStudentIds.add(studentId.toString());
          }
        });
      }
    });

    // Calculate date range for weekly/monthly views
    let dateFilter = {};
    if (view === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { submittedAt: { $gte: weekAgo } };
    } else if (view === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { submittedAt: { $gte: monthAgo } };
    }


    // Get all published assessments from these classes
    const assessments = await Assessment.find({
      classId: { $in: classIds },
      published: true
    }).select('_id category').lean();

    const assessmentIds = assessments.map((a: any) => a._id.toString());

    // Get submissions for all students from these assessments
    const submissions = await Submission.find({
      studentId: { $in: Array.from(allStudentIds) },
      assessmentId: { $in: assessmentIds },
      status: { $in: ['submitted', 'late', 'graded'] },
      ...dateFilter
    }).lean();

    // Calculate stats for each student
    const studentStats = new Map();
    
    for (const studentId of allStudentIds) {
      const studentSubmissions = submissions.filter(
        s => s.studentId.toString() === studentId
      );

      const totalPoints = studentSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
      const assessmentsCompleted = studentSubmissions.length;
      
      // Count by category
      const quizzesCompleted = studentSubmissions.filter(s => {
        const assessment = assessments.find((a: any) => a._id.toString() === s.assessmentId);
        return assessment?.category === 'Quiz';
      }).length;
      
      const examsCompleted = studentSubmissions.filter(s => {
        const assessment = assessments.find((a: any) => a._id.toString() === s.assessmentId);
        return assessment?.category === 'Exam';
      }).length;
      
      const activitiesCompleted = studentSubmissions.filter(s => {
        const assessment = assessments.find((a: any) => a._id.toString() === s.assessmentId);
        return assessment?.category === 'Activity';
      }).length;
      
      // Calculate average as percentage
      const averageScore = assessmentsCompleted > 0
        ? Math.round(studentSubmissions.reduce((sum, s) => {
            const percentage = s.maxScore ? (s.score / s.maxScore * 100) : 0;
            return sum + percentage;
          }, 0) / assessmentsCompleted)
        : 0;

      // Calculate streak (consecutive days with submissions)
      const submissionDates = studentSubmissions
        .map(s => new Date(s.submittedAt).toDateString())
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      let streak = 0;
      const today = new Date().toDateString();
      if (submissionDates.includes(today) || (submissionDates.length > 0 && submissionDates[0] === new Date(Date.now() - 86400000).toDateString())) {
        streak = 1;
        for (let i = 1; i < submissionDates.length; i++) {
          const prevDate = new Date(submissionDates[i - 1]);
          const currDate = new Date(submissionDates[i]);
          const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);
          if (diffDays === 1) {
            streak++;
          } else {
            break;
          }
        }
      }

      // Determine badges based on performance
      const badges = [];
      if (averageScore === 100) badges.push('perfect_score');
      if (averageScore >= 90) badges.push('achiever');
      if (streak >= 7) badges.push('consistent');
      if (assessmentsCompleted >= 10) badges.push('scholar');

      studentStats.set(studentId, {
        totalPoints,
        quizzesCompleted,
        examsCompleted,
        activitiesCompleted,
        assessmentsCompleted,
        averageScore,
        streak,
        badges
      });
    }

    // Get student details
    const students = await User.find({
      _id: { $in: Array.from(allStudentIds) }
    }).select('firstName lastName email').lean();

    // Combine student data with stats
    const leaderboardData = students.map((student: any) => {
      const stats = studentStats.get(student._id.toString()) || {
        totalPoints: 0,
        quizzesCompleted: 0,
        examsCompleted: 0,
        activitiesCompleted: 0,
        assessmentsCompleted: 0,
        averageScore: 0,
        streak: 0,
        badges: []
      };

      return {
        _id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        avatar: '👤',
        stats
      };
    });

    // Sort based on sortBy parameter
    leaderboardData.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'points':
          return b.stats.totalPoints - a.stats.totalPoints;
        case 'average':
          return b.stats.averageScore - a.stats.averageScore;
        case 'completed':
          return b.stats.assessmentsCompleted - a.stats.assessmentsCompleted;
        case 'streak':
          return b.stats.streak - a.stats.streak;
        default:
          return b.stats.totalPoints - a.stats.totalPoints;
      }
    });

    // Add rank
    leaderboardData.forEach((student: any, index: number) => {
      student.stats.rank = index + 1;
    });

    // Cache the results - use SHORT TTL for leaderboards (30 seconds)
    // since they change frequently with new submissions
    cache.set(cacheKey, leaderboardData, {
      ttl: CACHE_TTL.SHORT,
      tags: [cacheTags.leaderboard]
    });

    return NextResponse.json({
      success: true,
      students: leaderboardData,
      cached: false
    });

  } catch (error) {
    console.error('Error fetching student leaderboards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboards' },
      { status: 500 }
    );
  }
}
