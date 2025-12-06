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
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';

//MIDDLEWARE
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/student_page/assessment/[id]
 * Get assessment for student to take
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Get the assessment
    const assessment = await Assessment.findById(id)
      .select('-questions.answer') // Hide answers from students
      .lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Check if assessment is published and available
    if (!assessment.published) {
      return NextResponse.json({ error: 'Assessment is not published' }, { status: 403 });
    }

    const now = new Date();
    if (assessment.availableFrom && now < assessment.availableFrom) {
      return NextResponse.json({ 
        error: 'Assessment is not yet available',
        availableFrom: assessment.availableFrom
      }, { status: 403 });
    }

    if (assessment.availableUntil && now > assessment.availableUntil) {
      return NextResponse.json({ 
        error: 'Assessment is no longer available',
        availableUntil: assessment.availableUntil
      }, { status: 403 });
    }

    // Check how many attempts the student has made
    const existingAttempts = await Submission.countDocuments({
      assessmentId: id,
      studentId: authResult.userId.toString()
    });

    const maxAttempts = assessment.maxAttempts || 1;
    if (existingAttempts >= maxAttempts) {
      return NextResponse.json({ 
        error: 'Maximum attempts reached',
        attempts: existingAttempts,
        maxAttempts
      }, { status: 403 });
    }

    // Prepare questions for student (remove sensitive data)
    const studentQuestions = assessment.questions.map((q: any) => {
      const studentQuestion: any = {
        id: q.id,
        type: q.type,
        title: q.title,
        required: q.required,
        points: q.points
      };

      // Include type-specific fields but not answers
      if (q.type === 'mcq' || q.type === 'checkboxes') {
        studentQuestion.options = q.options;
      }
      if (q.type === 'enumeration') {
        studentQuestion.items = q.items;
      }
      if (q.type === 'match') {
        // For matching, only provide left items, student will match to right
        studentQuestion.pairs = q.pairs?.map((p: any) => ({ left: p.left }));
      }
      if (q.type === 'title' || q.type === 'section') {
        studentQuestion.description = q.description;
      }
      if (q.type === 'image') {
        studentQuestion.src = q.src;
        studentQuestion.alt = q.alt;
      }

      return studentQuestion;
    });

    return NextResponse.json({
      success: true,
      data: {
        assessment: {
          ...assessment,
          questions: studentQuestions
        },
        attemptInfo: {
          current: existingAttempts,
          maximum: maxAttempts,
          remaining: maxAttempts - existingAttempts
        }
      }
    });

  } catch (error) {
    console.error('Error fetching assessment for student:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/student_page/assessment/[id]
 * Submit student assessment responses
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const body = await request.json();
    const { responses, timeSpent, startedAt } = body;

    // Get the assessment with answers for grading
    const assessment = await Assessment.findById(id).lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Verify student can still submit
    const now = new Date();
    if (assessment.availableUntil && now > assessment.availableUntil) {
      return NextResponse.json({ error: 'Assessment deadline has passed' }, { status: 403 });
    }

    // Check attempts
    const existingAttempts = await Submission.countDocuments({
      assessmentId: id,
      studentId: authResult.userId.toString()
    });

    const maxAttempts = assessment.maxAttempts || 1;
    if (existingAttempts >= maxAttempts) {
      return NextResponse.json({ error: 'Maximum attempts exceeded' }, { status: 403 });
    }

    // Auto-grade the submission
    let totalScore = 0;
    let maxScore = 0;
    const gradedResponses = responses.map((response: any) => {
      const question = assessment.questions.find((q: any) => q.id === response.questionId);
      if (!question) return response;

      const points = question.points || 1;
      maxScore += points;

      let isCorrect = false;
      let earnedPoints = 0;

      // Grade based on question type
      switch (question.type) {
        case 'mcq':
          // For MCQ, check if selected option matches the first option (simple implementation)
          // In a real system, you'd store correct answer indices
          isCorrect = response.answer === question.options?.[0];
          break;
        
        case 'identification':
          // Case-insensitive comparison with stored answer
          if (question.answer && typeof response.answer === 'string') {
            isCorrect = question.answer.toLowerCase().trim() === response.answer.toLowerCase().trim();
          }
          break;
        
        case 'short':
        case 'paragraph':
          // These need manual grading, mark as partially correct for now
          earnedPoints = points * 0.5; // Give partial credit pending manual review
          break;
        
        default:
          // Other question types need manual grading
          earnedPoints = 0;
      }

      if (isCorrect) {
        earnedPoints = points;
      }

      totalScore += earnedPoints;

      return {
        ...response,
        isCorrect,
        points: earnedPoints
      };
    });

    // Determine if submission is late
    const isLate = assessment.dueDate && now > assessment.dueDate;

    // Create submission record
    const submission = new Submission({
      assessmentId: id,
      studentId: authResult.userId.toString(),
      classId: assessment.classId,
      submittedAt: now,
      status: isLate ? 'late' : 'submitted',
      score: Math.round(totalScore * 100) / 100, // Use actual score, not percentage
      maxScore: maxScore, // Use actual max score from questions
      responses: gradedResponses,
      timeSpent: timeSpent || 0,
      attemptNumber: existingAttempts + 1,
      startedAt: startedAt ? new Date(startedAt) : now,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    await submission.save();

    return NextResponse.json({
      success: true,
      data: {
        submission: {
          id: submission._id,
          score: submission.score,
          maxScore: submission.maxScore,
          status: submission.status,
          submittedAt: submission.submittedAt,
          attemptNumber: submission.attemptNumber
        }
      }
    });

  } catch (error) {
    console.error('Error submitting assessment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}