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
import Submission from '@/models/submission';

//MIDDLEWARE
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/v1/student/class/[classId]
 * Get class details for student view including announcements, resources, assessments, and activities
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
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

    // Resolve teacher information robustly (populate might not always work)
    let teacherInfo = { name: 'Unknown Teacher', email: '', department: 'CCS Department' };
    try {
      const teacherPop = typedClassDoc.teacherId as any;
      if (teacherPop && teacherPop.firstName) {
        teacherInfo.name = `${teacherPop.firstName || ''} ${teacherPop.lastName || ''}`.trim();
        teacherInfo.email = teacherPop.email || '';
      } else if (typedClassDoc.teacherId) {
        const t = await User.findById(typedClassDoc.teacherId).select('firstName lastName email').lean() as any;
        if (t) {
          teacherInfo.name = `${t.firstName || ''} ${t.lastName || ''}`.trim();
          teacherInfo.email = t.email || '';
        }
      }
    } catch (e) {
      console.warn('Failed to resolve teacher info for class', typedClassDoc._id, e);
    }

    // Resolve enrolled students, preferring User records when available
    const activeEnrollments = (typedClassDoc.students || []).filter((s: any) => s.status === 'active');
    const studentIds = activeEnrollments.map((s: any) => s.studentId);

    let studentDetails: any[] = [];
    try {
      if (studentIds.length > 0) {
        studentDetails = await User.find({ _id: { $in: studentIds } }).select('firstName lastName email').lean();
      }
    } catch (e) {
      console.warn('Failed to fetch student User records for class', typedClassDoc._id, e);
    }

    // Try resolving by enrollment email too (legacy data fallback)
    try {
      const enrollmentEmails = activeEnrollments.map((e: any) => e.email).filter((em: any) => !!em).map((em: string) => em.toLowerCase());
      if (enrollmentEmails.length > 0) {
        const usersByEmail = await User.find({ email: { $in: enrollmentEmails } }).select('firstName lastName email').lean() as any[];
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

    const students = await Promise.all(activeEnrollments.map(async (student: any) => {
      let user = studentDetails.find((u: any) => u._id?.toString() === student.studentId?.toString());
      if (!user && student.email) {
        user = studentDetails.find((u: any) => (u.email || '').toLowerCase() === (student.email || '').toLowerCase());
      }

      // If still not found, attempt to resolve this enrollment.studentId against common fields
      if (!user && student.studentId) {
        try {
          const possible = await User.findOne({
            $or: [
              { _id: student.studentId },
              { email: student.studentId },
              { username: student.studentId }
            ]
          }).select('firstName lastName email').lean() as any;
          if (possible) user = possible;
        } catch (e) {
          // ignore lookup errors
        }
      }

      return {
        id: student.studentId,
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (student.name || 'Student'),
        email: user ? (user.email || '') : (student.email || '')
      };
    }));

    // DEBUG logs
    try {
      console.debug('[v1 student_route] teacherInfo:', teacherInfo);
      console.debug('[v1 student_route] studentDetails count:', (studentDetails || []).length);
    } catch (e) {}

    // Base class information
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
      return NextResponse.json({
        success: true,
        data: { class: classDetails }
      });
    }

    // Get assessments for this class
    const assessments = await Assessment.find({ 
      classId: classId,
      // Only show published assessments to students, or those with due dates
      $or: [
        { published: true },
        { dueDate: { $exists: true } }
      ]
    })
    .select('title type category format dueDate points description instructions published accessCode createdAt')
    .sort({ createdAt: -1 })
    .lean();

    // Transform assessments to match student interface
    const studentAssessments = assessments.map((assessment: any) => ({
      id: assessment._id.toString(),
      title: assessment.title,
      type: assessment.type === 'MCQ' ? 'Quiz' : assessment.type === 'TF' ? 'Quiz' : 'Exam',
      format: assessment.format || 'online',
      dueDate: assessment.dueDate ? new Date(assessment.dueDate).toLocaleString() : '',
      points: (assessment.totalPoints !== undefined && assessment.totalPoints !== null) ? assessment.totalPoints : (assessment.points || 100),
      description: assessment.description || '',
      instructions: assessment.instructions || '',
      createdAt: assessment.createdAt ? new Date(assessment.createdAt).toLocaleString() : '',
      published: assessment.published || false,
      accessCode: assessment.accessCode || '',
      category: assessment.category || 'Activity'
    }));

    // Attach current student's submissions for these assessments (if any)
    try {
      const assessmentIds = studentAssessments.map((a: any) => a.id);
      if (assessmentIds.length > 0) {
        const studentSubmissions = await Submission.find({
          classId: classId,
          assessmentId: { $in: assessmentIds },
          studentId: authResult.userId.toString()
        }).lean();

        const submissionsMap: Record<string, any> = {};
        for (const s of (studentSubmissions || [])) {
          submissionsMap[String(s.assessmentId)] = s;
        }

        // Enrich studentAssessments with submission info
        for (const a of studentAssessments) {
          const s = submissionsMap[String(a.id)];
          if (s) {
            (a as any).submission = {
              score: s.score ?? null,
              maxScore: s.maxScore ?? null,
              submittedAt: s.submittedAt ? new Date(s.submittedAt).toISOString() : null,
              status: s.status || null,
              files: s.files || []
            };
          }
        }
      }
    } catch (e) {
      console.warn('Failed to attach student submissions to assessments', e);
    }

    // Mock activities (can be enhanced later with real activity tracking)
    const activities = studentAssessments.map((assessment: any) => ({
      id: assessment.id,
      title: assessment.title,
      dueDate: assessment.dueDate,
      points: assessment.points,
      status: 'missing' as const, // This would need to be tracked in submissions
      description: assessment.description,
      postedAt: assessment.createdAt || ''
    }));

    // Attach submission info to activities when available (reuse submission data added to studentAssessments)
    try {
      for (const act of activities) {
        const matching = studentAssessments.find((a: any) => a.id === act.id);
        if (matching && (matching as any).submission) {
          (act as any).submission = (matching as any).submission;
          // Update status from submission if available
          if ((act as any).submission.status === 'graded' || (act as any).submission.submittedAt) {
            (act as any).status = (act as any).submission.status === 'late' ? 'late' : 'submitted';
          }
        }
      }
    } catch (e) {
      // non-fatal
    }

    // Get actual posts and announcements from the class
    const posts = (typedClassDoc.posts || []).map((post: any) => ({
      id: post.id,
      author: post.authorName,
      timestamp: new Date(post.createdAt).toLocaleString(),
      content: post.body,
      attachments: [], // Can be enhanced later with attachment support
      comments: [] // Can be enhanced later with comment support
    }));

    // Include announcements as feed posts
    const announcements = (typedClassDoc.announcements || []).map((announcement: any) => ({
      id: announcement.id,
      author: teacherInfo.name,
      timestamp: new Date(announcement.createdAt).toLocaleString(),
      content: `📢 **${announcement.title}**\n\n${announcement.body}`,
      attachments: [],
      comments: []
    }));

    // Combine posts and announcements, sort by date (newest first)
    const allFeedItems = [...posts, ...announcements].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const feed = allFeedItems.length > 0 ? allFeedItems : [
      {
        id: 'welcome-post',
        author: teacherInfo.name,
        timestamp: new Date(typedClassDoc.createdAt).toLocaleString(),
        content: `Welcome to ${typedClassDoc.name}! This is your class feed where announcements and updates will be posted.`,
        attachments: [],
        comments: []
      }
    ];

    // Get actual resources from the class
    const resources = (typedClassDoc.resources || []).map((resource: any) => ({
      id: resource.id,
      title: resource.name,
      type: resource.type,
      description: resource.description || '',
      url: resource.url || '#',
      mimeType: resource.type.toLowerCase().includes('pdf') ? 'application/pdf' : 
                resource.type.toLowerCase().includes('image') ? 'image/*' :
                resource.type.toLowerCase().includes('video') ? 'video/*' :
                resource.type.toLowerCase().includes('doc') ? 'application/msword' :
                'application/octet-stream',
      sizeKB: resource.sizeBytes ? Math.round(resource.sizeBytes / 1024) : undefined
    }));

    const detailedClassInfo = {
      ...classDetails,
      activities,
      feed,
      resources,
      assessments: studentAssessments
    };

    return NextResponse.json({
      success: true,
      data: { class: detailedClassInfo }
    });

  } catch (error) {
    console.error('Error fetching student class details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}