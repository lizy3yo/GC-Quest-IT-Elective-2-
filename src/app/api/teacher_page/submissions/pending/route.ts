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

/**
 * GET /api/teacher_page/submissions/pending
 * Get all pending submissions for the teacher (needs grading)
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
    const limit = parseInt(searchParams.get('limit') || '0'); // 0 means no limit - fetch all
    const page = parseInt(searchParams.get('page') || '1');

    // Get all assessments for this teacher
    const assessments = await Assessment.find({
      teacherId: authResult.userId.toString()
    }).select('_id').lean();

    const assessmentIds = assessments.map((a: any) => a._id);

    // Get pending submissions (submitted or late, but not graded)
    const query = {
      assessmentId: { $in: assessmentIds },
      status: { $in: ['submitted', 'late'] }
    };

    // Fetch all pending submissions by default (no pagination unless explicitly requested)
    let submissionsQuery = Submission.find(query).sort({ submittedAt: -1 });
    
    // Only apply pagination if limit is explicitly set and greater than 0
    if (limit > 0) {
      submissionsQuery = submissionsQuery.limit(limit).skip((page - 1) * limit);
    }
    
    const submissions = await submissionsQuery.lean();

    const total = await Submission.countDocuments(query);

    // Get student and assessment details
    const studentIds = [...new Set(submissions.map((sub: any) => sub.studentId))];
    const submissionAssessmentIds = [...new Set(submissions.map((sub: any) => sub.assessmentId))];

    const [students, assessmentDetails] = await Promise.all([
      User.find({ _id: { $in: studentIds } }).select('_id firstName lastName email').lean(),
      Assessment.find({ _id: { $in: submissionAssessmentIds } }).select('_id title classId').lean()
    ]);

    const studentMap = new Map(students.map((s: any) => [s._id.toString(), s]));
    const assessmentMap = new Map(assessmentDetails.map((a: any) => [a._id.toString(), a]));

    const formattedSubmissions = submissions.map((sub: any) => {
      const student = studentMap.get(sub.studentId) || {};
      const assessment = assessmentMap.get(sub.assessmentId.toString()) || {};

      return {
        id: sub._id.toString(),
        studentId: sub.studentId,
        studentName: `${(student as any).firstName || 'Unknown'} ${(student as any).lastName || 'Student'}`.trim(),
        assessmentId: sub.assessmentId.toString(),
        assessmentTitle: (assessment as any).title || 'Unknown Assessment',
        classId: (assessment as any).classId?.toString() || sub.classId,
        submittedAt: sub.submittedAt,
        status: sub.status,
        type: sub.type || 'quiz_submission'
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        submissions: formattedSubmissions,
        count: total
      }
    });

  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
