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
import { cache, CACHE_TTL, cacheTags } from '@/lib/cache';

/**
 * GET /api/teacher_page/analytics/class-performance
 * Get performance metrics for each class
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Check cache first
    const cacheKey = `teacher:class-performance:${authResult.userId}:${limit}`;
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
    }).select('_id subject courseYear students classCode day time room').lean();

    // Get all assessments for this teacher
    const assessments = await Assessment.find({
      teacherId: authResult.userId.toString()
    }).select('_id classId').lean();

    // Build class performance data
    const performanceData = await Promise.all(
      classes.map(async (cls: any) => {
        const classId = cls._id.toString();
        const className = `${cls.subject} - ${cls.courseYear}`;
        const studentCount = (cls.students || []).length;

        // Get assessments for this class
        const classAssessments = assessments.filter(
          (a: any) => a.classId?.toString() === classId
        );
        const assessmentCount = classAssessments.length;
        const assessmentIds = classAssessments.map((a: any) => a._id);

        // Get graded submissions for this class
        const gradedSubmissions = await Submission.find({
          classId: classId,
          assessmentId: { $in: assessmentIds },
          status: 'graded',
          score: { $exists: true, $ne: null }
        }).select('score maxScore').lean();

        // Calculate average score and grade distribution
        let averageScore = 0;
        const gradeDistribution = {
          excellent: 0,      // 90-100%
          good: 0,           // 80-89%
          satisfactory: 0,   // 70-79%
          needsImprovement: 0 // <70%
        };

        if (gradedSubmissions.length > 0) {
          const totalScore = gradedSubmissions.reduce((sum: number, sub: any) => {
            const maxScore = sub.maxScore || 100;
            const normalizedScore = (sub.score / maxScore) * 100;
            
            // Categorize into grade bands
            if (normalizedScore >= 90) {
              gradeDistribution.excellent++;
            } else if (normalizedScore >= 80) {
              gradeDistribution.good++;
            } else if (normalizedScore >= 70) {
              gradeDistribution.satisfactory++;
            } else {
              gradeDistribution.needsImprovement++;
            }
            
            return sum + normalizedScore;
          }, 0);
          averageScore = Math.round(totalScore / gradedSubmissions.length);
        }

        // Calculate completion rate
        const totalPossibleSubmissions = studentCount * assessmentCount;
        const completionRate = totalPossibleSubmissions > 0 
          ? Math.round((gradedSubmissions.length / totalPossibleSubmissions) * 100)
          : 0;

        // Format schedule
        const days = Array.isArray(cls.day) ? cls.day.join(', ') : (cls.day || '');
        const schedule = `${days} ${cls.time || ''}`.trim() || 'TBD';

        return {
          classId,
          className,
          averageScore,
          studentCount,
          assessmentCount,
          submissionCount: gradedSubmissions.length,
          gradeDistribution,
          completionRate,
          classCode: cls.classCode || '',
          schedule: schedule,
          room: cls.room || ''
        };
      })
    );

    // Sort by average score (lowest first to identify struggling classes)
    performanceData.sort((a, b) => a.averageScore - b.averageScore);

    const responseData = {
      classes: performanceData.slice(0, limit)
    };

    // Cache for 5 minutes
    cache.set(cacheKey, responseData, {
      ttl: CACHE_TTL.MEDIUM,
      tags: [cacheTags.analytics, cacheTags.user(authResult.userId.toString())]
    });

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false
    });

  } catch (error) {
    console.error('Error fetching class performance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
