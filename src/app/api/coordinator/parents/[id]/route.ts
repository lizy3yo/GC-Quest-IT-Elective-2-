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

    // Update the parent
    const updatedParent = await User.findByIdAndUpdate(
      id,
      { firstName, lastName, email },
      { new: true, runValidators: true }
    );

    if (!updatedParent) {
      return NextResponse.json(
        { success: false, error: 'Parent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Parent updated successfully',
      data: {
        id: updatedParent._id.toString(),
        firstName: updatedParent.firstName,
        lastName: updatedParent.lastName,
        email: updatedParent.email
      }
    });
  } catch (error) {
    console.error('Error updating parent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update parent' },
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
      // Archive the parent
      const archivedParent = await User.findByIdAndUpdate(
        id,
        { archived: true, archivedAt: new Date() },
        { new: true }
      );

      if (!archivedParent) {
        return NextResponse.json(
          { success: false, message: 'Parent not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Parent archived successfully',
        data: {
          id: archivedParent._id.toString(),
          name: `${archivedParent.firstName} ${archivedParent.lastName}`
        }
      });
    } else if (action === 'unarchive') {
      // Unarchive the parent
      const unarchivedParent = await User.findByIdAndUpdate(
        id,
        { archived: false, archivedAt: null },
        { new: true }
      );

      if (!unarchivedParent) {
        return NextResponse.json(
          { success: false, message: 'Parent not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Parent unarchived successfully',
        data: {
          id: unarchivedParent._id.toString(),
          name: `${unarchivedParent.firstName} ${unarchivedParent.lastName}`
        }
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating parent:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update parent' },
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

    // Find and delete the parent
    const deletedParent = await User.findByIdAndDelete(id);

    if (!deletedParent) {
      return NextResponse.json(
        { success: false, message: 'Parent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Parent deleted successfully',
      data: {
        id: deletedParent._id.toString(),
        name: `${deletedParent.firstName} ${deletedParent.lastName}`
      }
    });
  } catch (error) {
    console.error('Error deleting parent:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete parent' },
      { status: 500 }
    );
  }
}
