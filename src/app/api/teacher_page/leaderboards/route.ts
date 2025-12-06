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
    if (!user || user.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'overall';
    const sortBy = searchParams.get('sortBy') || 'points';
    const classId = searchParams.get('classId');

    // Check cache first
    const cacheKey = cacheKeys.leaderboard(view, sortBy);
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        ...cachedData,
        cached: true
      });
    }

    // Get all classes taught by this teacher
    const classes = await Class.find({ teacherId: user._id.toString() }).lean();
    const classIds = classes.map(c => c._id);

    console.log('Leaderboard Initial Debug:', {
      teacherId: user._id,
      teacherRole: user.role,
      classesFound: classes.length,
      classIds: classIds.map((id: any) => id.toString())
    });

    if (view === 'overall' || view === 'weekly' || view === 'monthly') {
      // Get all students from teacher's classes
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

      // Get all assessments (quizzes, exams, activities) from teacher's classes - only fetch needed fields
      const assessments = await Assessment.find({
        classId: { $in: classIds },
        teacherId: user._id.toString(),
        published: true
      }).select('_id category').lean();

      const assessmentIds = assessments.map((a: any) => a._id.toString());

      // Create assessment category map for faster lookups
      const assessmentCategoryMap = new Map(
        assessments.map((a: any) => [a._id.toString(), a.category])
      );

      // Get submissions for all students from these assessments - only fetch needed fields
      const submissions = await Submission.find({
        studentId: { $in: Array.from(allStudentIds) },
        assessmentId: { $in: assessmentIds },
        status: { $in: ['submitted', 'late', 'graded'] },
        ...dateFilter
      }).select('studentId assessmentId score maxScore submittedAt').lean();

      // Calculate stats for each student
      const studentStats = new Map();
      
      for (const studentId of allStudentIds) {
        const studentSubmissions = submissions.filter(
          s => s.studentId.toString() === studentId
        );

        // Calculate total points and average percentage
        const totalPoints = studentSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
        const assessmentsCompleted = studentSubmissions.length;
        
        // Count by category using the pre-built map for faster lookups
        const quizzesCompleted = studentSubmissions.filter(s => 
          assessmentCategoryMap.get(s.assessmentId.toString()) === 'Quiz'
        ).length;
        
        const examsCompleted = studentSubmissions.filter(s => 
          assessmentCategoryMap.get(s.assessmentId.toString()) === 'Exam'
        ).length;
        
        const activitiesCompleted = studentSubmissions.filter(s => 
          assessmentCategoryMap.get(s.assessmentId.toString()) === 'Activity'
        ).length;
        
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
          badges,
          achievements: []
        });
      }

      // Get student details - only fetch needed fields
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
          badges: [],
          achievements: []
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
            return b.stats.quizzesCompleted - a.stats.quizzesCompleted;
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

      // Cache the results
      cache.set(cacheKey, { students: leaderboardData }, {
        ttl: CACHE_TTL.SHORT,
        tags: [cacheTags.leaderboard]
      });

      return NextResponse.json({
        success: true,
        students: leaderboardData,
        cached: false
      });
    }

    if (view === 'class') {
      // Fetch all assessments for all classes at once to reduce queries
      const allAssessments = await Assessment.find({
        classId: { $in: classIds },
        teacherId: user._id.toString(),
        published: true
      }).select('_id category classId').lean();

      // Group assessments by classId for faster lookups
      const assessmentsByClass = new Map<string, any[]>();
      allAssessments.forEach((assessment: any) => {
        const classIdStr = assessment.classId.toString();
        if (!assessmentsByClass.has(classIdStr)) {
          assessmentsByClass.set(classIdStr, []);
        }
        assessmentsByClass.get(classIdStr)!.push(assessment);
      });

      // Get all student IDs across all classes
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

      // Fetch all submissions at once
      const allSubmissions = await Submission.find({
        studentId: { $in: Array.from(allStudentIds) },
        assessmentId: { $in: allAssessments.map((a: any) => a._id) },
        status: { $in: ['submitted', 'late', 'graded'] }
      }).select('studentId assessmentId score maxScore submittedAt').lean();

      // Fetch all students at once
      const allStudents = await User.find({
        _id: { $in: Array.from(allStudentIds) }
      }).select('firstName lastName email').lean();

      // Create student map for faster lookups
      const studentMap = new Map(
        allStudents.map((s: any) => [s._id.toString(), s])
      );

      // Get leaderboard for each class
      const classLeaderboards = classes.map((cls: any) => {
        // Extract studentId from student objects and filter active students
        const studentIds = cls.students
          .filter((s: any) => s.status === 'active' || !s.status)
          .map((s: any) => (s.studentId || s).toString());
        
        // Get assessments for this class from pre-fetched data
        const classAssessments = assessmentsByClass.get(cls._id.toString()) || [];
        const classAssessmentIds = classAssessments.map((a: any) => a._id.toString());

        // Create assessment category map for this class
        const assessmentCategoryMap = new Map(
          classAssessments.map((a: any) => [a._id.toString(), a.category])
        );

        // Filter submissions for this class's students from pre-fetched data
        const submissions = allSubmissions.filter(
          s => studentIds.includes(s.studentId.toString()) && 
               classAssessmentIds.includes(s.assessmentId.toString())
        );

        // Calculate stats for each student
        const studentStats = new Map();
        
        for (const studentId of studentIds) {
          const studentSubmissions = submissions.filter(
            s => s.studentId.toString() === studentId
          );

          const totalPoints = studentSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
          const assessmentsCompleted = studentSubmissions.length;
          
          // Count by category using the pre-built map for faster lookups
          const quizzesCompleted = studentSubmissions.filter(s => 
            assessmentCategoryMap.get(s.assessmentId.toString()) === 'Quiz'
          ).length;
          
          const examsCompleted = studentSubmissions.filter(s => 
            assessmentCategoryMap.get(s.assessmentId.toString()) === 'Exam'
          ).length;
          
          const activitiesCompleted = studentSubmissions.filter(s => 
            assessmentCategoryMap.get(s.assessmentId.toString()) === 'Activity'
          ).length;
          
          // Calculate average as percentage
          const averageScore = assessmentsCompleted > 0
            ? Math.round(studentSubmissions.reduce((sum, s) => {
                const percentage = s.maxScore ? (s.score / s.maxScore * 100) : 0;
                return sum + percentage;
              }, 0) / assessmentsCompleted)
            : 0;

          // Calculate streak
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
            badges,
            achievements: []
          });
        }

        // Get student details from pre-fetched data
        const classStudents = studentIds.map((studentId: string) => {
          const student: any = studentMap.get(studentId);
          if (!student) return null;
          const stats = studentStats.get(studentId) || {
            totalPoints: 0,
            quizzesCompleted: 0,
            examsCompleted: 0,
            activitiesCompleted: 0,
            assessmentsCompleted: 0,
            averageScore: 0,
            streak: 0,
            badges: [],
            achievements: []
          };

          return {
            _id: student._id,
            name: `${student.firstName} ${student.lastName}`,
            email: student.email,
            avatar: '👤',
            stats
          };
        }).filter(Boolean); // Remove null entries

        classStudents.sort((a: any, b: any) => {
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

        classStudents.forEach((student: any, index: number) => {
          student.stats.rank = index + 1;
        });

        return {
          _id: cls._id,
          name: cls.name,
          subject: cls.subject,
          students: classStudents
        };
      });

      // Cache class leaderboards
      cache.set(cacheKey, { classes: classLeaderboards }, {
        ttl: CACHE_TTL.SHORT,
        tags: [cacheTags.leaderboard]
      });

      return NextResponse.json({
        success: true,
        classes: classLeaderboards,
        cached: false
      });
    }

    return NextResponse.json({
      success: true,
      students: []
    });

  } catch (error) {
    console.error('Error fetching leaderboards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboards' },
      { status: 500 }
    );
  }
}
