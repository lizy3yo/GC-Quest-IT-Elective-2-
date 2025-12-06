import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import Class from '@/models/class';

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

    // Update the teacher
    const updatedTeacher = await User.findByIdAndUpdate(
      id,
      { firstName, lastName, email },
      { new: true, runValidators: true }
    );

    if (!updatedTeacher) {
      return NextResponse.json(
        { success: false, error: 'Teacher not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Teacher updated successfully',
      data: {
        id: updatedTeacher._id.toString(),
        firstName: updatedTeacher.firstName,
        lastName: updatedTeacher.lastName,
        email: updatedTeacher.email
      }
    });
  } catch (error) {
    console.error('Error updating teacher:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update teacher' },
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
      // Archive the teacher
      const archivedTeacher = await User.findByIdAndUpdate(
        id,
        { archived: true, archivedAt: new Date() },
        { new: true }
      );

      if (!archivedTeacher) {
        return NextResponse.json(
          { success: false, message: 'Teacher not found' },
          { status: 404 }
        );
      }

      // Also archive all classes taught by this teacher
      await Class.updateMany(
        { teacherId: id },
        { archived: true, archivedAt: new Date() }
      );

      return NextResponse.json({
        success: true,
        message: 'Teacher archived successfully',
        data: {
          id: archivedTeacher._id.toString(),
          name: `${archivedTeacher.firstName} ${archivedTeacher.lastName}`
        }
      });
    } else if (action === 'unarchive') {
      // Unarchive the teacher
      const unarchivedTeacher = await User.findByIdAndUpdate(
        id,
        { archived: false, archivedAt: null },
        { new: true }
      );

      if (!unarchivedTeacher) {
        return NextResponse.json(
          { success: false, message: 'Teacher not found' },
          { status: 404 }
        );
      }

      // Also unarchive all classes taught by this teacher
      await Class.updateMany(
        { teacherId: id },
        { archived: false, archivedAt: null }
      );

      return NextResponse.json({
        success: true,
        message: 'Teacher unarchived successfully',
        data: {
          id: unarchivedTeacher._id.toString(),
          name: `${unarchivedTeacher.firstName} ${unarchivedTeacher.lastName}`
        }
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating teacher:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update teacher' },
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

    // Find and delete the teacher
    const deletedTeacher = await User.findByIdAndDelete(id);

    if (!deletedTeacher) {
      return NextResponse.json(
        { success: false, message: 'Teacher not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Teacher deleted successfully',
      data: {
        id: deletedTeacher._id.toString(),
        name: `${deletedTeacher.firstName} ${deletedTeacher.lastName}`
      }
    });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete teacher' },
      { status: 500 }
    );
  }
}
