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
import Class from '@/models/class';
import User from '@/models/user';

//MIDDLEWARE
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * GET /api/student_page/class
 * Get all classes where the student is enrolled
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('active'); // 'true', 'false'
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    // Build query to find classes where this student is enrolled
    const query: any = {
      $and: [
        {
          students: {
            $elemMatch: {
              studentId: authResult.userId.toString(),
              status: 'active'
            }
          }
        }
      ]
    };
    
    if (isActive !== null && isActive !== undefined) {
      query.$and.push({ isActive: isActive === 'true' });
    } else {
      // Default to only active classes
      query.$and.push({ isActive: true });
    }

    // Get classes with pagination
    const skip = (page - 1) * limit;
    const classes = await Class.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get teacher information for each class
    const classesWithTeacher = await Promise.all(
      classes.map(async (classItem) => {
        const teacher = await User.findById(classItem.teacherId)
          .select('firstName lastName')
          .lean() as { firstName?: string; lastName?: string } | null;
        
        const activeStudentCount = classItem.students?.filter(
          (s: any) => s.status === 'active'
        ).length || 0;

        return {
          _id: classItem._id,
          name: classItem.name,
          teacher: teacher ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() : 'Unknown Teacher',
          subject: classItem.subject,
          studentCount: activeStudentCount,
          classCode: classItem.classCode,
          description: classItem.description,
          createdAt: classItem.createdAt,
          courseYear: classItem.courseYear,
          day: classItem.day,
          time: classItem.time,
          room: classItem.room
        };
      })
    );

    // Get total count for pagination
    const total = await Class.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: {
        classes: classesWithTeacher,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          count: classesWithTeacher.length,
          totalItems: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching student classes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/student_page/class
 * Join a class using class code
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { classCode } = body;

    // Validate required fields
    if (!classCode) {
      return NextResponse.json(
        { error: 'Class code is required' },
        { status: 400 }
      );
    }

    // Find the class by class code
    const classDoc = await Class.findOne({ 
      classCode: classCode.toUpperCase(),
      isActive: true 
    });

    if (!classDoc) {
      return NextResponse.json(
        { error: 'Invalid class code or class is not active' },
        { status: 404 }
      );
    }

    // Check if student is already enrolled
    const isAlreadyEnrolled = classDoc.students.some(
      (s: any) => s.studentId === authResult.userId.toString() && s.status === 'active'
    );

    if (isAlreadyEnrolled) {
      return NextResponse.json(
        { error: 'You are already enrolled in this class' },
        { status: 400 }
      );
    }

    // Add student to class
    try {
      classDoc.addStudent(authResult.userId.toString());
      await classDoc.save();

      // Get teacher info for response
      const teacher = await User.findById(classDoc.teacherId)
        .select('firstName lastName')
        .lean() as { firstName?: string; lastName?: string } | null;

      return NextResponse.json({
        success: true,
        message: 'Successfully joined the class',
        data: {
          class: {
            _id: classDoc._id,
            name: classDoc.name,
            teacher: teacher ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() : 'Unknown Teacher',
            subject: classDoc.subject,
            classCode: classDoc.classCode,
            description: classDoc.description
          }
        }
      }, { status: 201 });

    } catch (error) {
      if (error instanceof Error && error.message.includes('maximum student capacity')) {
        return NextResponse.json(
          { error: 'Class has reached maximum student capacity' },
          { status: 400 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Error joining class:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}