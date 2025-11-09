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

interface RouteParams {
  params: Promise<{ id: string; activityId: string }>;
}

/**
 * GET /api/teacher_page/class/[id]/activity/[activityId]/submissions
 * Get all student submissions for a specific activity
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Authorize teacher role
    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    await connectToDatabase();

    const { id: classId, activityId } = await params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    // Verify the class belongs to this teacher
    const classData = await Class.findOne({
      _id: classId,
      teacherId: authResult.userId.toString()
    }).lean();

    if (!classData) {
      return NextResponse.json({ error: 'Class not found or access denied' }, { status: 404 });
    }

    // Verify the activity/assessment exists and belongs to this class
    const assessment = await Assessment.findOne({
      _id: activityId,
      classId: classId,
      teacherId: authResult.userId.toString()
    }).lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Activity not found or access denied' }, { status: 404 });
    }

    // Build query for submissions
    const query: any = { 
      assessmentId: activityId,
      classId: classId
    };
    
    if (studentId) {
      query.studentId = studentId;
    }

    // Get submissions for this activity
    const submissions = await Submission.find(query)
      .sort({ submittedAt: -1 })
      .lean();

    // Get student information for all submissions
    const studentIds = [...new Set(submissions.map(sub => sub.studentId))];
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student'
    }).select('_id firstName lastName email').lean();

    // Create a map of student info
    const studentMap = new Map();
    students.forEach((student: any) => {
      studentMap.set(student._id.toString(), {
        studentId: student._id.toString(),
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email
      });
    });

    // Format submissions with student info
    const formattedSubmissions = submissions.map((submission: any) => {
      const studentInfo = studentMap.get(submission.studentId) || {
        studentId: submission.studentId,
        firstName: 'Unknown',
        lastName: 'Student',
        email: 'unknown@example.com'
      };

      return {
        id: submission._id.toString(),
        studentId: submission.studentId,
        studentName: `${studentInfo.firstName} ${studentInfo.lastName}`.trim(),
        studentEmail: studentInfo.email,
        files: submission.files || [],
        comment: submission.comment || '',
        submittedAt: submission.submittedAt,
        status: submission.status,
        grade: submission.grade || null,
        feedback: submission.feedback || '',
        attemptNumber: submission.attemptNumber || 1,
        type: submission.type || 'file_submission'
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        activity: {
          id: assessment._id.toString(),
          title: assessment.title,
          description: assessment.description || '',
          instructions: assessment.instructions || '',
          dueDate: assessment.dueDate,
          totalPoints: assessment.totalPoints || 100,
          attachments: assessment.attachments || []
        },
        submissions: formattedSubmissions,
        studentsCount: studentIds.length,
        submissionsCount: submissions.length
      }
    });

  } catch (error) {
    console.error('Error fetching activity submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}