import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, email } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: id } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already in use' },
        { status: 400 }
      );
    }

    // Update the student
    const updatedStudent = await User.findByIdAndUpdate(
      id,
      { firstName, lastName, email },
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Student updated successfully',
      data: {
        id: updatedStudent._id.toString(),
        firstName: updatedStudent.firstName,
        lastName: updatedStudent.lastName,
        email: updatedStudent.email
      }
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update student' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'archive') {
      // Archive the student
      const archivedStudent = await User.findByIdAndUpdate(
        id,
        { archived: true, archivedAt: new Date() },
        { new: true }
      );

      if (!archivedStudent) {
        return NextResponse.json(
          { success: false, message: 'Student not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Student archived successfully',
        data: {
          id: archivedStudent._id.toString(),
          name: `${archivedStudent.firstName} ${archivedStudent.lastName}`
        }
      });
    } else if (action === 'unarchive') {
      // Unarchive the student
      const unarchivedStudent = await User.findByIdAndUpdate(
        id,
        { archived: false, archivedAt: null },
        { new: true }
      );

      if (!unarchivedStudent) {
        return NextResponse.json(
          { success: false, message: 'Student not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Student unarchived successfully',
        data: {
          id: unarchivedStudent._id.toString(),
          name: `${unarchivedStudent.firstName} ${unarchivedStudent.lastName}`
        }
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update student' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();

    const { id } = await params;

    // Find and delete the student
    const deletedStudent = await User.findByIdAndDelete(id);

    if (!deletedStudent) {
      return NextResponse.json(
        { success: false, message: 'Student not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Student deleted successfully',
      data: {
        id: deletedStudent._id.toString(),
        name: `${deletedStudent.firstName} ${deletedStudent.lastName}`
      }
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete student' },
      { status: 500 }
    );
  }
}
