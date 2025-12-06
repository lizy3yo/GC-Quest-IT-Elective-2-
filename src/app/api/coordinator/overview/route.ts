import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import Class from '@/models/class';
import Assessment from '@/models/assessment';
import Resource from '@/models/resource';
import Flashcard from '@/models/flashcard';
import { Summary } from '@/models/summary';
import { cache, cacheKeys, CACHE_TTL, cacheTags } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d'; // Default to 30 days

    // Check cache first
    const cacheKey = cacheKeys.coordinatorOverview(range);
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    await connectToDatabase();

    // Get counts (excluding archived items)
    const totalTeachers = await User.countDocuments({ role: 'teacher', archived: { $ne: true } });
    const totalStudents = await User.countDocuments({ role: 'student', archived: { $ne: true } });
    const totalClasses = await Class.countDocuments({ archived: { $ne: true } });
    const totalAssessments = await Assessment.countDocuments();
    const totalFlashcards = await Flashcard.countDocuments();
    const totalSummaries = await Summary.countDocuments();
    const totalResources = await Resource.countDocuments();

    // Get program distribution (by parsing courseYear)
    const classes = await Class.find({ archived: { $ne: true } }).select('courseYear subject');
    const programDistribution: Record<string, number> = {};
    const subjectDistribution: Record<string, number> = {};

    classes.forEach(cls => {
      // Parse program from courseYear (e.g., "BSIT - 3A" -> "BSIT")
      const program = cls.courseYear?.split('-')[0]?.trim() || 'Unknown';
      programDistribution[program] = (programDistribution[program] || 0) + 1;

      // Track subject distribution
      const subject = cls.subject || 'Unknown';
      subjectDistribution[subject] = (subjectDistribution[subject] || 0) + 1;
    });

    // Convert to array format for charts
    const programData = Object.entries(programDistribution).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // Top 5 subjects
    const subjectData = Object.entries(subjectDistribution)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // User role distribution
    const roleDistribution = [
      { name: 'Teachers', value: totalTeachers },
      { name: 'Students', value: totalStudents },
      { name: 'Parents', value: await User.countDocuments({ role: 'parent', archived: { $ne: true } }) }
    ];

    // User growth based on selected range
    const now = new Date();
    let startDate = new Date();
    let groupBy: any = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' },
      role: '$role'
    };

    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '6m':
        startDate.setMonth(now.getMonth() - 6);
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          role: '$role'
        };
        break;
      default:
        startDate.setDate(now.getDate() - 7); // Default 7d
    }

    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          archived: { $ne: true },
          role: { $in: ['teacher', 'student', 'parent'] }
        }
      },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Generate complete date range
    const dateRange: { date: string, teacher: number, student: number, parent: number }[] = [];
    const currentDate = new Date(startDate);

    if (range === '6m') {
      // Generate monthly range
      while (currentDate <= now) {
        const dateLabel = currentDate.toLocaleString('default', { month: 'short', year: 'numeric' });
        dateRange.push({ date: dateLabel, teacher: 0, student: 0, parent: 0 });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    } else {
      // Generate daily range
      while (currentDate <= now) {
        const dateLabel = currentDate.toLocaleString('default', { month: 'short', day: 'numeric' });
        dateRange.push({ date: dateLabel, teacher: 0, student: 0, parent: 0 });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Merge actual data into the complete date range
    userGrowth.forEach((item: any) => {
      let dateLabel;

      if (range === '6m') {
        dateLabel = new Date(item._id.year, item._id.month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
      } else {
        dateLabel = new Date(item._id.year, item._id.month - 1, item._id.day).toLocaleString('default', { month: 'short', day: 'numeric' });
      }

      const dateEntry = dateRange.find(d => d.date === dateLabel);
      if (dateEntry) {
        const role = item._id.role as 'teacher' | 'student' | 'parent';
        if (role === 'teacher' || role === 'student' || role === 'parent') {
          dateEntry[role] += item.count;
        }
      }
    });

    const growthData = dateRange;

    // Recent activity (last 15 users and classes created)
    const recentUsers = await User.find({ archived: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(15)
      .select('firstName lastName role createdAt')
      .lean();

    const recentClasses = await Class.find({ archived: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(15)
      .select('name courseYear createdAt')
      .lean();

    const recentActivity = [
      ...recentUsers.map((user: any) => ({
        type: 'user' as const,
        role: user.role as 'teacher' | 'student' | 'parent',
        description: `${user.firstName} ${user.lastName}`,
        timestamp: user.createdAt
      })),
      ...recentClasses.map((cls: any) => ({
        type: 'class' as const,
        description: `${cls.name} - ${cls.courseYear}`,
        timestamp: cls.createdAt
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);

    const responseData = {
      totalTeachers,
      totalStudents,
      totalClasses,
      totalAssessments,
      totalResources: totalResources + totalFlashcards + totalSummaries,
      programDistribution: programData,
      subjectDistribution: subjectData,
      roleDistribution,
      userGrowth: growthData,
      recentActivity
    };

    // Cache for 5 minutes - coordinator overview doesn't change frequently
    cache.set(cacheKey, responseData, {
      ttl: CACHE_TTL.MEDIUM,
      tags: [cacheTags.coordinator]
    });

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch overview statistics' },
      { status: 500 }
    );
  }
}
