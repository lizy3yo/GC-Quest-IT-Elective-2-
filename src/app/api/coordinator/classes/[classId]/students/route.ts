import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Class from '@/models/class';
import User from '@/models/user';

// POST - Add students to a class
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    await connectToDatabase();

    const { classId } = await params;
    const body = await request.json();
    const { studentIds } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student IDs array is required' },
        { status: 400 }
      );
    }

    // Find the class
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    // Verify all students exist
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student'
    });

    if (students.length !== studentIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more invalid student IDs' },
        { status: 400 }
      );
    }

    // Add students to class
    let addedCount = 0;
    let alreadyEnrolledCount = 0;

    for (const studentId of studentIds) {
      const existingStudent = classDoc.students.find(
        (s: any) => s.studentId === studentId && s.status === 'active'
      );

      if (existingStudent) {
        alreadyEnrolledCount++;
      } else {
        // Check if student was previously dropped
        const droppedStudent = classDoc.students.find(
          (s: any) => s.studentId === studentId && s.status === 'dropped'
        );

        if (droppedStudent) {
          // Re-enroll the student
          droppedStudent.status = 'active';
          droppedStudent.enrolledAt = new Date();
        } else {
          // Add new student
          classDoc.students.push({
            studentId,
            enrolledAt: new Date(),
            status: 'active'
          });
        }
        addedCount++;
      }
    }

    await classDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        addedCount,
        alreadyEnrolledCount,
        totalStudents: classDoc.students.filter((s: any) => s.status === 'active').length
      }
    });
  } catch (error) {
    console.error('Error adding students to class:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add students to class' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a student from a class
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    await connectToDatabase();

    const { classId } = await params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Find the class
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    // Find and remove the student
    const studentIndex = classDoc.students.findIndex(
      (s: any) => s.studentId === studentId && s.status === 'active'
    );

    if (studentIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Student not found in this class' },
        { status: 404 }
      );
    }

    classDoc.students[studentIndex].status = 'dropped';
    await classDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        message: 'Student removed from class successfully'
      }
    });
  } catch (error) {
    console.error('Error removing student from class:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove student from class' },
      { status: 500 }
    );
  }
}
