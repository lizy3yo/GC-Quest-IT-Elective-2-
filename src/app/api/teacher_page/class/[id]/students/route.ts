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
 * GET /api/teacher_page/class/[id]/students
 * Get students in a class
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

    const classDoc = await Class.findOne({
      _id: id,
      teacherId: authResult.userId.toString()
    }).lean() as any;

    if (!classDoc) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Get active students
    const activeStudents = classDoc.students?.filter((s: any) => s.status === 'active') || [];
    const studentIds = activeStudents.map((s: any) => s.studentId);

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { students: [] }
      });
    }

    // Get student details
    const studentDetails = await User.find({
      _id: { $in: studentIds }
    }).select('firstName lastName email username').lean();

    // Combine enrollment info with user details
    const studentsWithDetails = activeStudents.map((enrollment: any) => {
      const userDetail = studentDetails.find((user: any) => 
        user._id.toString() === enrollment.studentId
      );
      return {
        studentId: enrollment.studentId,
        enrolledAt: enrollment.enrolledAt,
        status: enrollment.status,
        ...userDetail
      };
    });

    return NextResponse.json({
      success: true,
      data: { students: studentsWithDetails }
    });

  } catch (error) {
    console.error('Error fetching class students:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher_page/class/[id]/students
 * Add student to class by email
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find the student by email
    const student = await User.findOne({ 
      email, 
      role: 'student' 
    }).select('_id firstName lastName email').lean() as any;

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found with this email' },
        { status: 404 }
      );
    }

    // Await params before accessing properties
    const { id } = await params;

    // Find the class
    const classDoc = await Class.findOne({
      _id: id,
      teacherId: authResult.userId.toString()
    });

    if (!classDoc) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Add student to class
    try {
      const added = classDoc.addStudent(student._id.toString());
      await classDoc.save();

      if (!added) {
        return NextResponse.json(
          { error: 'Student is already enrolled in this class' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { 
          student,
          message: 'Student added to class successfully'
        }
      }, { status: 201 });

    } catch (error) {
      if (error instanceof Error && error.message.includes('maximum student capacity')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Error adding student to class:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}