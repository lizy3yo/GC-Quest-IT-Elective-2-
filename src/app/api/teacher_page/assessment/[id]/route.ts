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
import Class from '@/models/class';

//MIDDLEWARE
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/teacher_page/assessment/[id]
 * Get a specific assessment by ID
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

    // Await params before accessing properties
    const { id } = await params;

    const assessment = await Assessment.findOne({
      _id: id,
      teacherId: authResult.userId.toString()
    }).lean();

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { assessment }
    });

  } catch (error) {
    console.error('Error fetching assessment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teacher_page/assessment/[id]
 * Update a specific assessment
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    
    // Await params before accessing properties
    const { id } = await params;
    
    // Find the assessment and verify ownership
    const assessment = await Assessment.findOne({
      _id: id,
      teacherId: authResult.userId.toString()
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Update allowed fields
    const updateFields = [
      'title', 'description', 'type', 'category', 'questions', 'timeLimitMins',
      'totalPoints',
      'maxAttempts', 'dueDate', 'availableFrom', 'availableUntil', 'shuffleQuestions',
      'shuffleOptions', 'showResults', 'allowReview', 'passingScore', 'instructions',
      'attachments', 'settings'
    ];

    // Auto-publish when updating assessment and generate access code if needed
    if (!assessment.published) {
      assessment.published = true;
      if (!assessment.accessCode) {
        assessment.accessCode = generateAccessCode();
      }
    }

    updateFields.forEach(field => {
      if (body[field] !== undefined) {
        if (field === 'dueDate' || field === 'availableFrom' || field === 'availableUntil') {
          assessment[field] = body[field] ? new Date(body[field]) : undefined;
        } else if (field === 'questions') {
          // Process questions to ensure they have IDs
          assessment[field] = body[field].map((q: any, index: number) => ({
            ...q,
            id: q.id || `q_${Date.now()}_${index}`
          }));
        } else {
          assessment[field] = body[field];
        }
      }
    });

    await assessment.save();

    return NextResponse.json({
      success: true,
      data: { assessment }
    });

  } catch (error) {
    console.error('Error updating assessment:', error);
    
    if (error instanceof Error) {
      if (error.name === 'ValidationError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.message },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teacher_page/assessment/[id]
 * Delete a specific assessment
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Await params before accessing properties
    const { id } = await params;

    const assessment = await Assessment.findOneAndDelete({
      _id: id,
      teacherId: authResult.userId.toString()
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Assessment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting assessment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
/**

 * Generate a random access code for assessments
 */
function generateAccessCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}