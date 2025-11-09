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

//NODE MODULES
import { NextRequest, NextResponse } from 'next/server';

//CUSTOM MODULES
import { connectToDatabase } from '@/lib/mongoose';
import Submission from '@/models/submission';
import Assessment from '@/models/assessment';
import User from '@/models/user';
import Class from '@/models/class';

//MIDDLEWARE
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/teacher_page/assessment/[id]/submissions
 * Get all submissions for a specific assessment
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: assessmentId } = await params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    // Verify the assessment belongs to this teacher
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      teacherId: authResult.userId.toString()
    }).lean();

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Build query
    const query: any = { assessmentId };
    if (studentId) {
      query.studentId = studentId;
    }

    // Get submissions with pagination
    const submissions = await Submission.find(query)
      .sort({ submittedAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    // Get total count
    const total = await Submission.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: {
        submissions,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          count: submissions.length,
          totalItems: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher_page/assessment/[id]/submissions
 * Create a new submission (typically called by students)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Allow both students and teachers to create submissions
    const authzResult = await authorize(authResult.userId, ['student', 'teacher']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    await connectToDatabase();

    const { id: assessmentId } = await params;
    const body = await request.json();
    const {
      studentId,
      responses,
      timeSpent,
      startedAt
    } = body;

    // Get the user to check their role
    const user = await User.findById(authResult.userId).select('role').lean() as any;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If teacher is creating submission, require studentId
    // If student is creating submission, use their own ID
    const submittingStudentId = user.role === 'teacher' ? studentId : authResult.userId.toString();

    if (!submittingStudentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Verify the assessment exists and type it properly
    const assessment = await Assessment.findById(assessmentId).lean() as any;
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Check if assessment is available for submission
    if (!assessment.published) {
      return NextResponse.json({ error: 'Assessment is not published' }, { status: 400 });
    }

    // Check due date
    const now = new Date();
    let isLate = false;
    if (assessment.dueDate && now > new Date(assessment.dueDate)) {
      isLate = true;
    }

    // Get student's previous attempts
    const existingSubmissions = await Submission.find({
      assessmentId,
      studentId: submittingStudentId
    }).sort({ attemptNumber: -1 });

    // Check if student has exceeded max attempts
    if (assessment.maxAttempts && existingSubmissions.length >= assessment.maxAttempts) {
      return NextResponse.json(
        { error: 'Maximum attempts exceeded' },
        { status: 400 }
      );
    }

    const attemptNumber = existingSubmissions.length + 1;

    // Get client info
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create submission
    const submission = new Submission({
      assessmentId,
      studentId: submittingStudentId,
      classId: assessment.classId,
      submittedAt: now,
      status: isLate ? 'late' : 'submitted',
      responses: responses || [],
      timeSpent,
      attemptNumber,
      ipAddress: clientIP,
      userAgent,
      startedAt: startedAt ? new Date(startedAt) : undefined
    });

    // Auto-grade if possible
    const gradingResult = submission.autoGrade(assessment);
    
    // If all questions were auto-graded, mark as graded
    const allQuestionsGraded = submission.responses.every((r: any) => r.isCorrect !== undefined);
    if (allQuestionsGraded && submission.responses.length > 0) {
      submission.status = 'graded';
      submission.gradedAt = now;
    }

    await submission.save();

    return NextResponse.json({
      success: true,
      data: {
        submission,
        gradingResult
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}