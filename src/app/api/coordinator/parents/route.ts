import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import { cache, CACHE_TTL, cacheTags } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = 'coordinator:parents';
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: { parents: cachedData },
        cached: true
      });
    }

    await connectToDatabase();

    // Get all parents
    const parents = await User.find({ role: 'parent' }).lean();

    // Get stats for each parent
    const parentStats = await Promise.all(
      parents.map(async (parent: any) => {
        const parentId = parent._id.toString();
        
        // Get linked student information
        let linkedStudentInfo = null;
        if (parent.linkedStudentId) {
          const student = await User.findById(parent.linkedStudentId).lean();
          if (student) {
            linkedStudentInfo = {
              id: student._id.toString(),
              name: `${student.firstName} ${student.lastName}`,
              email: student.email,
              studentNumber: student.studentNumber
            };
          }
        }
        
        return {
          id: parentId,
          name: `${parent.firstName} ${parent.lastName}`,
          email: parent.email,
          linkedStudent: linkedStudentInfo,
          archived: parent.archived || false,
          archivedAt: parent.archivedAt || null,
        };
      })
    );

    // Cache for 5 minutes
    cache.set(cacheKey, parentStats, {
      ttl: CACHE_TTL.MEDIUM,
      tags: [cacheTags.coordinator]
    });

    return NextResponse.json({
      success: true,
      data: { parents: parentStats },
      cached: false
    });
  } catch (error) {
    console.error('Error fetching parent stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch parent statistics' },
      { status: 500 }
    );
  }
}
