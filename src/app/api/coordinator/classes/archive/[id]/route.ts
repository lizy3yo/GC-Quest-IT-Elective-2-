import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Class from '@/models/class';

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
      // Archive the class
      const archivedClass = await Class.findByIdAndUpdate(
        id,
        { archived: true, archivedAt: new Date() },
        { new: true }
      );

      if (!archivedClass) {
        return NextResponse.json(
          { success: false, message: 'Class not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Class archived successfully',
        data: {
          id: archivedClass._id.toString(),
          name: archivedClass.name
        }
      });
    } else if (action === 'unarchive') {
      // Unarchive the class
      const unarchivedClass = await Class.findByIdAndUpdate(
        id,
        { archived: false, archivedAt: null },
        { new: true }
      );

      if (!unarchivedClass) {
        return NextResponse.json(
          { success: false, message: 'Class not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Class unarchived successfully',
        data: {
          id: unarchivedClass._id.toString(),
          name: unarchivedClass.name
        }
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating class:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update class' },
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

    // Find and delete the class
    const deletedClass = await Class.findByIdAndDelete(id);

    if (!deletedClass) {
      return NextResponse.json(
        { success: false, message: 'Class not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully',
      data: {
        id: deletedClass._id.toString(),
        name: deletedClass.name
      }
    });
  } catch (error) {
    console.error('Error deleting class:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete class' },
      { status: 500 }
    );
  }
}
