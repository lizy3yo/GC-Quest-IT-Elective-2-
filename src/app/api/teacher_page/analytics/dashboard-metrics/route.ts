/*
 * Copyright 2025 Kharl Ryan M. De Jesus
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';
import Submission from '@/models/submission';
import Assessment from '@/models/assessment';
import Class from '@/models/class';
import { cache, cacheKeys, CACHE_TTL, cacheTags } from '@/lib/cache';

/**
 * GET /api/teacher_page/analytics/dashboard-metrics
 * Get aggregated metrics for teacher dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    // Check cache first
    const cacheKey = cacheKeys.dashboardMetrics(authResult.userId.toString());
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    await connectToDatabase();

    // Get all classes for this teacher
    const classes = await Class.find({
      teacherId: authResult.userId.toString(),
      isActive: true
    }).select('students').lean();

    const totalClasses = classes.length;

    // Calculate total students (unique across all classes)
    const allStudentIds = new Set<string>();
    for (const cls of classes) {
      const students = (cls as any).students || [];
      students.forEach((student: any) => {
        // Students are stored as objects with studentId property
        const id = student.studentId || student;
        allStudentIds.add(id.toString());
      });
    }
    const totalStudents = allStudentIds.size;

    // Get all assessments for this teacher
    const assessments = await Assessment.find({
      teacherId: authResult.userId.toString()
    }).select('_id dueDate').lean();

    const assessmentIds = assessments.map((a: any) => a._id);

    // Count pending submissions (submitted or late, but not graded)
    const pendingSubmissions = await Submission.countDocuments({
      assessmentId: { $in: assessmentIds },
      status: { $in: ['submitted', 'late'] }
    });

    // Count upcoming assessments (due in next 7 days)
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingAssessments = assessments.filter((a: any) => {
      if (!a.dueDate) return false;
      const dueDate = new Date(a.dueDate);
      return dueDate >= now && dueDate <= nextWeek;
    }).length;

    const metricsData = {
      totalClasses,
      totalStudents,
      pendingSubmissions,
      upcomingAssessments
    };

    // Cache for 1 minute - dashboard metrics change frequently
    cache.set(cacheKey, metricsData, {
      ttl: CACHE_TTL.SHORT,
      tags: [cacheTags.analytics, cacheTags.user(authResult.userId.toString())]
    });

    return NextResponse.json({
      success: true,
      data: metricsData,
      cached: false
    });

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
