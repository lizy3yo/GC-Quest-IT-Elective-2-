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

export const runtime = 'nodejs';

import { connectToDatabase } from '@/lib/mongoose';
import Class from '@/models/class';
import User from '@/models/user';
import Assessment from '@/models/assessment';
import { cache, CACHE_TTL, cacheTags } from '@/lib/cache';

//MIDDLEWARE
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/student_page/class/[classId]
 * Get class details for student view including announcements, resources, assessments, and activities
 */
export async function GET(
  request: NextRequest,
  context: any
) {
  const params = await context.params;
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Authorize student role
    const authzResult = await authorize(authResult.userId, ['student']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    await connectToDatabase();

    const { classId } = await params;
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';

    // Check cache first
    const cacheKey = `student:class:${classId}:${authResult.userId}:${includeDetails}`;
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // Find the class and check if student is enrolled
    const classDoc = await Class.findById(classId)
      .populate('teacherId', 'firstName lastName email')
      .lean();

    if (!classDoc) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Type assertion for the populated document
    const typedClassDoc = classDoc as any;

    // Check if student is enrolled in this class
    const isEnrolled = typedClassDoc.students?.some(
      (s: any) => s.studentId === authResult.userId.toString() && s.status === 'active'
    );

    if (!isEnrolled) {
      return NextResponse.json(
        { error: 'Access denied. You are not enrolled in this class.' },
        { status: 403 }
      );
    }

    // Get teacher information. Ensure we return a name/email even if populate failed
    let teacherInfo = { name: 'Unknown Teacher', email: '', department: 'CCS Department' };
    try {
      const teacherPop = typedClassDoc.teacherId as any;
      if (teacherPop && teacherPop.firstName) {
        teacherInfo.name = `${teacherPop.firstName || ''} ${teacherPop.lastName || ''}`.trim();
        teacherInfo.email = teacherPop.email || '';
      } else if (typedClassDoc.teacherId) {
        // If teacherId was not populated, try fetching the User directly
        const t = await User.findById(typedClassDoc.teacherId).select('firstName lastName email').lean() as any;
        if (t) {
          teacherInfo.name = `${t.firstName || ''} ${t.lastName || ''}`.trim();
          teacherInfo.email = t.email || '';
        }
      }
    } catch (e) {
      // ignore and keep defaults
      console.warn('Failed to resolve teacher info for class', typedClassDoc._id, e);
    }

    // Get enrolled students for class list (include user details when available)
    const activeEnrollments = (typedClassDoc.students || []).filter((s: any) => s.status === 'active');
    const studentIds = activeEnrollments.map((s: any) => s.studentId);

    // Resolve student user records and fall back to enrollment-provided name/email
    let studentDetails: any[] = [];
    try {
      if (studentIds.length > 0) {
        studentDetails = await User.find({ _id: { $in: studentIds } }).select('firstName lastName email').lean();
      }
    } catch (e) {
      console.warn('Failed to fetch student User records for class', typedClassDoc._id, e);
    }

    // If we didn't find users by id, or if there are enrollments with emails, also try resolving by email
    try {
      const enrollmentEmails = activeEnrollments
        .map((e: any) => e.email)
        .filter((em: any) => !!em)
        .map((em: string) => em.toLowerCase());

      if (enrollmentEmails.length > 0) {
        const usersByEmail = await User.find({ email: { $in: enrollmentEmails } }).select('firstName lastName email').lean() as any[];
        // Merge usersByEmail into studentDetails, avoiding duplicates by email or _id
        const existingEmails = new Set((studentDetails || []).map((u: any) => (u.email || '').toLowerCase()));
        for (const u of usersByEmail) {
          if (!existingEmails.has((u.email || '').toLowerCase())) {
            studentDetails.push(u);
            existingEmails.add((u.email || '').toLowerCase());
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch student User records by email for class', typedClassDoc._id, e);
    }

    const students = await Promise.all(activeEnrollments.map(async (enrollment: any) => {
      // try to match by _id first
      let user = studentDetails.find((u: any) => u._id?.toString() === enrollment.studentId?.toString());
      // if not found, try match by email (some legacy enrollments may only have email)
      if (!user && enrollment.email) {
        user = studentDetails.find((u: any) => (u.email || '').toLowerCase() === (enrollment.email || '').toLowerCase());
      }

      // If still not found, try resolving by common identifiers (id, email, username)
      if (!user && enrollment.studentId) {
        try {
          const possible = await User.findOne({
            $or: [
              { _id: enrollment.studentId },
              { email: enrollment.studentId },
              { username: enrollment.studentId }
            ]
          }).select('firstName lastName email').lean() as any;
          if (possible) user = possible;
        } catch (e) {
          // ignore
        }
      }

      return {
        id: enrollment.studentId,
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (enrollment.name || 'Student'),
        email: user ? (user.email || '') : (enrollment.email || '')
      };
    }));

    // Base class information
    // DEBUG: log resolved teacher and student details (temporary)
    try {
      console.debug('[student_route] resolved teacherInfo:', teacherInfo);
      console.debug('[student_route] resolved studentDetails count:', (studentDetails || []).length);
    } catch (e) {
      // ignore debug failures
    }

    const classDetails = {
      _id: typedClassDoc._id,
      name: typedClassDoc.name,
      classCode: typedClassDoc.classCode,
      schedule: `${typedClassDoc.day?.join(', ') || 'TBD'} ${typedClassDoc.time || ''}`.trim(),
      subject: typedClassDoc.subject,
      courseYear: typedClassDoc.courseYear,
      description: typedClassDoc.description,
      instructor: teacherInfo,
      students: students,
      studentCount: students.length,
      createdAt: typedClassDoc.createdAt
    };

    if (!includeDetails) {
      // Cache basic class info for 5 minutes
      cache.set(cacheKey, { class: classDetails }, {
        ttl: CACHE_TTL.MEDIUM,
        tags: [cacheTags.class(classId), cacheTags.user(authResult.userId.toString())]
      });

      return NextResponse.json({
        success: true,
        data: { class: classDetails },
        cached: false
      });
    }

    // Only show published assessments to students
    const assessments = await Assessment.find({ 
      classId: classId,
      published: true
    })
    .select('title type category format dueDate points description instructions published accessCode createdAt scheduledOpen scheduledClose totalPoints')
    .sort({ createdAt: -1 })
    .lean();

    // Get real submission data for assessments and transform to student interface
    const Submission = (await import('@/models/submission')).default;

    const studentAssessments = await Promise.all(assessments.map(async (assessment: any) => {
      const id = assessment._id.toString();

      // Find the student's submission for this assessment
      const submission = await Submission.findOne({
        studentId: authResult.userId,
        assessmentId: id,
        classId: classId
      }).lean();

      // Normalize submission info we care about (safe guards for possible array types)
      let submissionInfo: any = null;
      if (submission && !(Array.isArray(submission))) {
        submissionInfo = {
          status: (submission as any).status || 'submitted',
          submittedAt: (submission as any).submittedAt ? new Date((submission as any).submittedAt).toISOString() : undefined,
          score: typeof (submission as any).score === 'number' ? (submission as any).score : undefined,
          maxScore: typeof (submission as any).maxScore === 'number' ? (submission as any).maxScore : undefined
        };
      }

      return {
        id,
        title: assessment.title,
        type: assessment.type === 'MCQ' ? 'Quiz' : assessment.type === 'TF' ? 'Quiz' : 'Exam',
        format: assessment.format || 'online',
        dueDate: assessment.dueDate ? new Date(assessment.dueDate).toLocaleString() : '',
        // Use totalPoints when available; fall back to legacy 'points' field and finally default to 100
        points: (assessment.totalPoints !== undefined && assessment.totalPoints !== null) ? assessment.totalPoints : (assessment.points || 100),
        description: assessment.description || '',
        instructions: assessment.instructions || '',
        published: assessment.published || false,
        accessCode: assessment.accessCode || '',
        category: assessment.category || 'Activity',
        scheduledOpen: assessment.scheduledOpen ? new Date(assessment.scheduledOpen).toISOString() : undefined,
        scheduledClose: assessment.scheduledClose ? new Date(assessment.scheduledClose).toISOString() : undefined,
        submission: submissionInfo
      };
    }));

    // Build activities list from assessments (include submission-derived status)
    const activities = studentAssessments.map((assessment: any) => {
      let status: 'submitted' | 'late' | 'missing' = 'missing';
      if (assessment.submission && assessment.submission.status) {
        // keep graded as 'submitted' conceptually; UI inspects submission.status === 'graded'
        status = assessment.submission.status === 'late' ? 'late' : (assessment.submission.status || 'submitted');
      }

      return {
        id: assessment.id,
        title: assessment.title,
        dueDate: assessment.dueDate,
        points: assessment.points,
        status,
        submittedAt: assessment.submission?.submittedAt,
        description: assessment.description
      };
    });

    // Mock feed posts (can be enhanced later with real announcement system)
    const feed = [
      {
        id: 'welcome-post',
        author: teacherInfo.name,
        timestamp: new Date(typedClassDoc.createdAt).toLocaleString(),
        content: `Welcome to ${typedClassDoc.name}! This is your class feed where announcements and updates will be posted.`,
        attachments: [],
        comments: []
      }
    ];

    // Mock resources (can be enhanced later with real resource system)
    const resources = [
      {
        id: 'syllabus',
        title: 'Course Syllabus',
        type: 'PDF',
        description: 'Course overview and policies',
        url: '#',
        mimeType: 'application/pdf',
        sizeKB: 250
      }
    ];

    const detailedClassInfo = {
      ...classDetails,
      activities,
      feed,
      resources,
      assessments: studentAssessments
    };

    // Cache detailed class info for 2 minutes (shorter TTL since it includes submission data)
    cache.set(cacheKey, { class: detailedClassInfo }, {
      ttl: CACHE_TTL.SHORT * 4, // 2 minutes
      tags: [cacheTags.class(classId), cacheTags.user(authResult.userId.toString())]
    });

    return NextResponse.json({
      success: true,
      data: { class: detailedClassInfo },
      cached: false
    });

  } catch (error) {
    console.error('Error fetching student class details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}