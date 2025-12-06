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
import User from '@/models/user';
import Class from '@/models/class';

/**
 * GET /api/teacher_page/activity/recent
 * Get recent activity for teacher's classes (submissions, enrollments, etc.)
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

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '15');
    const page = parseInt(searchParams.get('page') || '1');
    const days = parseInt(searchParams.get('days') || '7');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    console.log('Activity request params:', { limit, page, days, cutoffDate });

    // Get teacher's classes
    const teacherIdStr = authResult.userId.toString();
    console.log('Fetching classes for teacher:', teacherIdStr);
    
    const classes = await Class.find({
      teacherId: teacherIdStr,
      isActive: true
    }).select('_id subject courseYear students').lean();
    
    console.log('Found classes:', classes.length);

    const classMap = new Map<string, string>(classes.map((c: Record<string, unknown>) => [
      (c._id as { toString: () => string }).toString(),
      `${c.subject || ''} - ${c.courseYear || ''}`
    ]));

    // Get recent submissions
    const assessments = await Assessment.find({
      teacherId: teacherIdStr
    }).select('_id title classId dueDate').lean();
    
    console.log('Found assessments:', assessments.length);

    const assessmentIds = assessments.map((a: Record<string, unknown>) => a._id);
    const assessmentMap = new Map<string, { title: string; classId: unknown; dueDate: unknown }>(
      assessments.map((a: Record<string, unknown>) => [
        (a._id as { toString: () => string }).toString(),
        { 
          title: (a.title as string) || '', 
          classId: a.classId, 
          dueDate: a.dueDate 
        }
      ])
    );

    // First check total submissions without date filter
    const totalSubmissions = await Submission.countDocuments({
      assessmentId: { $in: assessmentIds }
    });
    console.log('Total submissions in DB (no date filter):', totalSubmissions);
    
    // Check submissions with submittedAt field
    const submissionsWithDate = await Submission.countDocuments({
      assessmentId: { $in: assessmentIds },
      submittedAt: { $exists: true }
    });
    console.log('Submissions with submittedAt field:', submissionsWithDate);
    
    // Check submissions within date range
    const submissionsInRange = await Submission.countDocuments({
      assessmentId: { $in: assessmentIds },
      submittedAt: { $gte: cutoffDate }
    });
    console.log('Submissions within date range (last', days, 'days):', submissionsInRange);
    
    const submissions = await Submission.find({
      assessmentId: { $in: assessmentIds },
      submittedAt: { $gte: cutoffDate }
    })
      .sort({ submittedAt: -1 })
      .lean();
    
    console.log('Found submissions:', submissions.length);
    
    // If no submissions in range, try fetching without date filter (fetch all, no limit)
    if (submissions.length === 0 && totalSubmissions > 0) {
      console.log('No submissions in date range, fetching all submissions...');
      const allSubmissions = await Submission.find({
        assessmentId: { $in: assessmentIds },
        submittedAt: { $exists: true }
      })
        .sort({ submittedAt: -1 })
        .lean(); // Removed .limit(50) to fetch all submissions
      console.log('Fetched all submissions:', allSubmissions.length);
      submissions.push(...allSubmissions);
    }

    // Get student details
    const studentIds = [...new Set(submissions.map((sub: Record<string, unknown>) => {
      const studentId = sub.studentId;
      return typeof studentId === 'string' ? studentId : 
             (studentId && typeof studentId === 'object' && 'toString' in studentId) ? 
             (studentId as { toString: () => string }).toString() : '';
    }).filter(id => id))];
    
    const students = await User.find({
      _id: { $in: studentIds }
    }).select('_id firstName lastName').lean();

    const studentMap = new Map<string, string>(students.map((s: Record<string, unknown>) => [
      (s._id as { toString: () => string }).toString(),
      `${s.firstName || ''} ${s.lastName || ''}`.trim()
    ]));

    // Format activities
    const activities: Array<{
      id: string;
      type: string;
      studentName: string;
      className: string;
      timestamp: Date;
      details?: string;
      score?: number;
    }> = [];

    // Get recent enrollments (students added to classes in the last N days)
    for (const cls of classes) {
      const clsAny = cls as Record<string, unknown>;
      const classStudents = (clsAny.students as unknown[]) || [];
      
      // Filter students enrolled within the cutoff date
      const recentEnrollments = classStudents.filter((s: unknown) => {
        if (s && typeof s === 'object' && 'enrolledAt' in s) {
          const enrolledAt = s.enrolledAt;
          if (enrolledAt && (typeof enrolledAt === 'string' || typeof enrolledAt === 'number' || enrolledAt instanceof Date)) {
            return new Date(enrolledAt) >= cutoffDate;
          }
        }
        return false;
      });

      console.log(`Class ${clsAny._id}: ${classStudents.length} total students, ${recentEnrollments.length} recent enrollments`);

      if (recentEnrollments.length > 0) {
        // Get student details
        const enrollmentStudentIds = recentEnrollments.map((s: any) => {
          const sid = s.studentId;
          return typeof sid === 'string' ? sid : 
                 (sid && typeof sid === 'object' && 'toString' in sid) ? 
                 sid.toString() : null;
        }).filter((id: any) => id);

        const enrolledStudents = await User.find({
          _id: { $in: enrollmentStudentIds }
        }).select('_id firstName lastName').lean();

        const enrolledStudentMap = new Map<string, Record<string, unknown>>(
          enrolledStudents.map((s: Record<string, unknown>) => [
            (s._id as { toString: () => string }).toString(), 
            s
          ])
        );

        for (const enrollment of recentEnrollments) {
          if (enrollment && typeof enrollment === 'object' && 'studentId' in enrollment && 'enrolledAt' in enrollment) {
            const studentId = typeof enrollment.studentId === 'string' ? 
              enrollment.studentId : enrollment.studentId?.toString();
            if (!studentId) continue;
            const student = enrolledStudentMap.get(studentId);
            
            if (student) {
              activities.push({
                id: `enrollment-${studentId}-${clsAny._id}`,
                type: 'enrollment',
                studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
                className: classMap.get((clsAny._id as { toString: () => string }).toString()) || 'Unknown Class',
                timestamp: new Date(enrollment.enrolledAt as string | number | Date)
              });
            }
          }
        }
      }
    }

    // Add submission activities
    for (const sub of submissions) {
      const subAny = sub as Record<string, unknown>;
      const assessmentId = subAny.assessmentId ? 
        (typeof subAny.assessmentId === 'object' && 'toString' in subAny.assessmentId ? 
          (subAny.assessmentId as { toString: () => string }).toString() : 
          String(subAny.assessmentId)) : '';
      const assessment = assessmentMap.get(assessmentId);
      const submittedAt = subAny.submittedAt as Date;
      const isLate = assessment?.dueDate && submittedAt && 
        new Date(submittedAt) > new Date(assessment.dueDate as string | number | Date);
      const needsHelp = subAny.score !== undefined && (subAny.score as number) < 60;

      let activityType = 'submission';
      if (isLate) activityType = 'late-submission';
      else if (needsHelp) activityType = 'needs-help';

      const assessmentClassId = assessment?.classId ? 
        (typeof assessment.classId === 'object' && 'toString' in assessment.classId ? 
          (assessment.classId as { toString: () => string }).toString() : 
          String(assessment.classId)) : '';

      const studentId = subAny.studentId;
      const studentIdStr = typeof studentId === 'string' ? studentId : 
                          (studentId && typeof studentId === 'object' && 'toString' in studentId) ? 
                          (studentId as { toString: () => string }).toString() : '';

      activities.push({
        id: (subAny._id as { toString: () => string }).toString(),
        type: activityType,
        studentName: studentMap.get(studentIdStr) || 'Unknown Student',
        className: classMap.get(assessmentClassId) || 'Unknown Class',
        timestamp: submittedAt,
        details: assessment?.title || 'Assessment',
        score: subAny.score as number | undefined
      });
    }

    // Sort by timestamp (most recent first)
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // If no recent activities found, try to get older submissions (up to 30 days)
    if (activities.length === 0 && assessmentIds.length > 0) {
      console.log('No recent activities, fetching older submissions...');
      const olderCutoffDate = new Date();
      olderCutoffDate.setDate(olderCutoffDate.getDate() - 30);
      
      const olderSubmissions = await Submission.find({
        assessmentId: { $in: assessmentIds },
        submittedAt: { $gte: olderCutoffDate }
      })
        .sort({ submittedAt: -1 })
        .limit(limit)
        .lean();
      
      console.log('Found older submissions:', olderSubmissions.length);
      
      // Get student details for older submissions
      const olderStudentIds = [...new Set(olderSubmissions.map((sub: Record<string, unknown>) => {
        const studentId = sub.studentId;
        return typeof studentId === 'string' ? studentId : 
               (studentId && typeof studentId === 'object' && 'toString' in studentId) ? 
               (studentId as { toString: () => string }).toString() : '';
      }).filter(id => id))];
      
      const olderStudents = await User.find({
        _id: { $in: olderStudentIds }
      }).select('_id firstName lastName').lean();

      const olderStudentMap = new Map<string, string>(olderStudents.map((s: Record<string, unknown>) => [
        (s._id as { toString: () => string }).toString(),
        `${s.firstName || ''} ${s.lastName || ''}`.trim()
      ]));
      
      // Add older submission activities
      for (const sub of olderSubmissions) {
        const subAny = sub as Record<string, unknown>;
        const assessmentId = subAny.assessmentId ? 
          (typeof subAny.assessmentId === 'object' && 'toString' in subAny.assessmentId ? 
            (subAny.assessmentId as { toString: () => string }).toString() : 
            String(subAny.assessmentId)) : '';
        const assessment = assessmentMap.get(assessmentId);
        const submittedAt = subAny.submittedAt as Date;

        const assessmentClassId = assessment?.classId ? 
          (typeof assessment.classId === 'object' && 'toString' in assessment.classId ? 
            (assessment.classId as { toString: () => string }).toString() : 
            String(assessment.classId)) : '';

        const studentId = subAny.studentId;
        const studentIdStr = typeof studentId === 'string' ? studentId : 
                            (studentId && typeof studentId === 'object' && 'toString' in studentId) ? 
                            (studentId as { toString: () => string }).toString() : '';

        activities.push({
          id: (subAny._id as { toString: () => string }).toString(),
          type: 'submission',
          studentName: olderStudentMap.get(studentIdStr) || 'Unknown Student',
          className: classMap.get(assessmentClassId) || 'Unknown Class',
          timestamp: submittedAt,
          details: assessment?.title || 'Assessment',
          score: subAny.score as number | undefined
        });
      }
    }

    // Apply pagination
    const totalActivities = activities.length;
    const totalPages = Math.ceil(totalActivities / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedActivities = activities.slice(startIndex, endIndex);
    
    console.log('Returning activities count:', paginatedActivities.length, 'of', totalActivities);
    if (paginatedActivities.length > 0) {
      console.log('Sample activity:', JSON.stringify(paginatedActivities[0], null, 2));
    }

    return NextResponse.json({
      success: true,
      data: {
        activities: paginatedActivities,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalActivities,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching recent activity:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
