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
import Assessment, { IAssessment } from '@/models/assessment';
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

    const assessmentDoc = await Assessment.findOne({
      _id: id,
      teacherId: authResult.userId.toString()
    }).lean() as (IAssessment & { _id: any }) | null;

    if (!assessmentDoc) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Get class name if classId exists
    let className = undefined;
    if (assessmentDoc.classId) {
      const classDoc = await Class.findById(assessmentDoc.classId).select('name').lean() as { name?: string } | null;
      className = classDoc?.name;
    }

    // Ensure settings object always has all fields explicitly set
    // This prevents issues where false values might be omitted
    const defaultSettings = {
      showProgress: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      allowReview: true,
      lockdown: false,
      trackTabSwitching: false,
      hideCorrectAnswers: false,
      allowBacktrack: true,
      autoSubmit: false
    };

    const assessment = {
      ...assessmentDoc,
      className,
      settings: {
        ...defaultSettings,
        ...(assessmentDoc.settings || {})
      }
    };

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
    
    console.log('PUT request body:', JSON.stringify(body, null, 2));
    
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
      'totalPoints', 'published', 'isLocked', 'scheduledOpen', 'scheduledClose',
      'maxAttempts', 'dueDate', 'availableFrom', 'availableUntil', 'showResults', 'passingScore', 'instructions',
      'attachments', 'settings', 'classId'
    ];

    // Handle published field
    if (body.published !== undefined) {
      assessment.published = body.published;
      // Lock by default when publishing if not specified
      if (body.published && body.isLocked === undefined && assessment.isLocked === undefined) {
        assessment.isLocked = true;
      }
    }

    updateFields.forEach(field => {
      if (body[field] !== undefined && field !== 'published') { // Skip published as it's handled above
        if (field === 'dueDate' || field === 'availableFrom' || field === 'availableUntil' || field === 'scheduledOpen' || field === 'scheduledClose') {
          assessment[field] = body[field] ? new Date(body[field]) : undefined;
        } else if (field === 'questions') {
          // Process questions to ensure they have IDs and preserve all fields
          assessment[field] = body[field].map((q: any, index: number) => {
            const question = {
              ...q,
              id: q.id || `q_${Date.now()}_${index}`
            };
            
            // For identification questions, ensure correctAnswer is saved to both fields for compatibility
            if (question.type === 'identification' && question.correctAnswer) {
              question.answer = question.correctAnswer;
            }
            
            console.log(`Question ${index + 1} timeLimit:`, q.timeLimit, 'Full question:', question);
            return question;
          });
          // Mark questions as modified to ensure Mongoose saves all fields
          assessment.markModified('questions');
        } else if (field === 'settings') {
          // Ensure all settings fields are explicitly saved
          const defaultSettings = {
            showProgress: true,
            shuffleQuestions: false,
            shuffleOptions: false,
            allowReview: true,
            lockdown: false,
            trackTabSwitching: false,
            hideCorrectAnswers: false,
            allowBacktrack: true,
            autoSubmit: false
          };
          
          const currentSettings = assessment[field]?.toObject ? assessment[field].toObject() : assessment[field] || {};
          
          // Merge with defaults first, then current, then new values
          // This ensures all fields are always present
          assessment[field] = {
            ...defaultSettings,
            ...currentSettings,
            ...body[field]
          };
          
          console.log('Settings before save:', assessment[field]);
          // Mark settings as modified for Mongoose
          assessment.markModified('settings');
        } else {
          assessment[field] = body[field];
        }
      }
    });

    await assessment.save();

    console.log('Assessment saved successfully. Settings in DB:', assessment.settings);

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
 * PATCH /api/teacher_page/assessment/[id]
 * Partially update an assessment (e.g., lock/unlock)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Update only the fields provided in the request
    if (body.isLocked !== undefined) {
      assessment.isLocked = body.isLocked;
      console.log(`${body.isLocked ? '🔒' : '🔓'} Assessment ${body.isLocked ? 'locked' : 'unlocked'}`);
    }

    await assessment.save();

    return NextResponse.json({
      success: true,
      data: { assessment }
    });

  } catch (error) {
    console.error('Error patching assessment:', error);
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
