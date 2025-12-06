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

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/teacher_page/class/[id]
 * Get a specific class by ID
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

    const { searchParams } = new URL(request.url);
    const includeStudentDetails = searchParams.get('includeStudents') === 'true';

    // Await params before accessing properties
    const { id } = await params;

    let classDoc = await Class.findOne({
      _id: id,
      teacherId: authResult.userId.toString()
    }).lean() as any;

    if (!classDoc) {
      console.error('Class not found for id/teacher:', { requestedId: id, teacherId: authResult.userId?.toString() });
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Populate teacher details
    const teacherDetails = await User.findById(classDoc.teacherId)
      .select('firstName lastName email')
      .lean() as any;

    if (teacherDetails) {
      classDoc.teacher = {
        _id: teacherDetails._id,
        firstName: teacherDetails.firstName,
        lastName: teacherDetails.lastName,
        email: teacherDetails.email,
        fullName: `${teacherDetails.firstName} ${teacherDetails.lastName}`.trim()
      };
    }

    // If requested, populate student details
    if (includeStudentDetails && classDoc.students && classDoc.students.length > 0) {
      const activeStudentIds = classDoc.students
        .filter((s: any) => s.status === 'active')
        .map((s: any) => s.studentId);
      
      if (activeStudentIds.length > 0) {
        const studentDetails = await User.find({
          _id: { $in: activeStudentIds }
        }).select('firstName lastName email').lean();

        // Merge student details with enrollment info
        const studentsWithDetails = classDoc.students.map((enrollment: any) => {
          if (enrollment.status === 'active') {
            const studentDetail = studentDetails.find((s: any) => s._id.toString() === enrollment.studentId);
            return {
              ...enrollment,
              ...studentDetail
            };
          }
          return enrollment;
        });

        classDoc = {
          ...classDoc,
          studentsWithDetails
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: { class: classDoc }
    });

  } catch (error) {
    console.error('Error fetching class:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teacher_page/class/[id]
 * Update a specific class
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
    
    // Find the class and verify ownership
    const classDoc = await Class.findOne({
      _id: id,
      teacherId: authResult.userId.toString()
    });

    if (!classDoc) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Update allowed fields
    const updateFields = [
      'name', 'courseYear', 'subject', 'description', 'maxStudents', 'isActive', 'settings'
    ];

    updateFields.forEach(field => {
      if (body[field] !== undefined) {
        classDoc[field] = body[field];
      }
    });

    await classDoc.save();

    return NextResponse.json({
      success: true,
      data: { class: classDoc }
    });

  } catch (error) {
    console.error('Error updating class:', error);
    
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
 * DELETE /api/teacher_page/class/[id]
 * Delete a specific class
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

    const classDoc = await Class.findOneAndDelete({
      _id: id,
      teacherId: authResult.userId.toString()
    });

    if (!classDoc) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // TODO: Consider if we should also delete related assessments
    // For now, we'll leave them as orphaned records

    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting class:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}