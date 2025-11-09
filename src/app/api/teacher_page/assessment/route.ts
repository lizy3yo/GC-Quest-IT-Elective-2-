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

/**
 * GET /api/teacher_page/assessment
 * Get all assessments for a teacher or specific class
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult; // Return authentication error response
    }

    // Authorize teacher role
    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) {
      return authzResult as Response; // Return authorization error response
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const category = searchParams.get('category'); // 'Quiz', 'Exam', 'Activity'
    const published = searchParams.get('published'); // 'true', 'false'
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    // Build query
    const query: any = { teacherId: authResult.userId.toString() };

    if (classId) {
      query.classId = classId;

      // Verify teacher owns this class
      const classExists = await Class.findOne({
        _id: classId,
        teacherId: authResult.userId.toString()
      });
      if (!classExists) {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 });
      }
    }

    if (category) {
      query.category = category;
    }

    if (published !== null && published !== undefined) {
      query.published = published === 'true';
    }

    // Get assessments with pagination
    const skip = (page - 1) * limit;
    const assessments = await Assessment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Assessment.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: {
        assessments,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          count: assessments.length,
          totalItems: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching assessments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher_page/assessment
 * Create a new assessment
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult; // Return authentication error response
    }

    // Authorize teacher role
    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) {
      return authzResult as Response; // Return authorization error response
    }

    await connectToDatabase();

    const body = await request.json();
    console.log('Received assessment creation request:', body);

    const {
      title,
      description,
      type,
      category,
      totalPoints,
      format,
      questions,
      classId,
      timeLimitMins,
      maxAttempts,
      dueDate,
      availableFrom,
      availableUntil,
      shuffleQuestions,
      shuffleOptions,
      showResults,
      allowReview,
      passingScore,
      instructions,
      attachments,
      settings
    } = body;

    // Validate required fields
    if (!title || !type || !category || !classId) {
      console.log('Missing required fields:', { title, type, category, classId });
      return NextResponse.json(
        { error: 'Missing required fields: title, type, category, classId' },
        { status: 400 }
      );
    }

    // Verify teacher owns the class
    console.log('Looking for class:', { classId, teacherId: authResult.userId.toString() });
    const classExists = await Class.findOne({
      _id: classId,
      teacherId: authResult.userId.toString()
    });
    console.log('Class found:', !!classExists);

    if (!classExists) {
      // For development: if the class doesn't exist in the database but we have a mock classId,
      // create a basic class record to allow assessment creation
      if (classId === 't-1' || classId.startsWith('mock-') || classId.startsWith('dev-class-')) {
        console.log('Creating mock class for development');
        try {
          const mockClass = new Class({
            name: 'Development Class',
            courseYear: 'DEV - 1A',
            subject: 'Development',
            description: 'Auto-created class for development',
            teacherId: authResult.userId.toString(),
            classCode: `DEV${Date.now().toString().slice(-6)}`,
            students: [],
            groups: [],
            announcements: [],
            resources: [],
            posts: [],
            settings: {
              allowStudentPosts: true,
              moderateStudentPosts: false,
              allowLateSubmissions: true,
              notifyOnNewStudent: true
            }
          });

          // Override the _id to match the requested classId if it's a valid ObjectId format
          // Otherwise, let MongoDB generate one
          if (classId.match(/^[0-9a-fA-F]{24}$/)) {
            (mockClass as any)._id = classId;
          }

          await mockClass.save();
          console.log('Mock class created successfully:', mockClass._id);
        } catch (error) {
          console.error('Failed to create mock class:', error);
          return NextResponse.json(
            { error: 'Class not found and could not create development class', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 404 }
          );
        }
      } else {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 });
      }
    }

    // Generate unique IDs for questions if not provided
    const processedQuestions = (questions || []).map((q: any, index: number) => ({
      ...q,
      id: q.id || `q_${Date.now()}_${index}`
    }));

    // Generate access code for published assessments
    const accessCode = generateAccessCode();

    // Create assessment
    const assessment = new Assessment({
      title,
      description,
      type,
      category,
      format: format || 'online', // Default to online format
      totalPoints: totalPoints || undefined,
      questions: processedQuestions,
      classId,
      teacherId: authResult.userId.toString(),
      timeLimitMins,
      maxAttempts: maxAttempts || 1,
      published: true, // Auto-publish when saving assessment
      accessCode: accessCode, // Generate access code
      dueDate: dueDate ? new Date(dueDate) : undefined,
      availableFrom: availableFrom ? new Date(availableFrom) : new Date(),
      availableUntil: availableUntil ? new Date(availableUntil) : undefined,
      shuffleQuestions: shuffleQuestions || false,
      shuffleOptions: shuffleOptions || false,
      showResults: showResults || 'immediately',
      allowReview: allowReview !== false,
      passingScore,
      instructions,
      attachments: attachments || [],
      settings: settings || {}
    });

    await assessment.save();

    return NextResponse.json({
      success: true,
      data: { assessment }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating assessment:', error);

    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.message },
          { status: 400 }
        );
      }

      // Handle cast errors (invalid ObjectId, etc.)
      if (error.name === 'CastError') {
        return NextResponse.json(
          { error: 'Invalid data format', details: error.message },
          { status: 400 }
        );
      }

      // Handle other specific errors
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Duplicate entry', details: 'Access code already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
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