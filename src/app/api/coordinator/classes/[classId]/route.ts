import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Class from '@/models/class';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    await connectToDatabase();

    const { classId } = await params;
    const body = await request.json();
    console.log('Update class request body:', body);
    console.log('Class ID:', classId);
    
    const { name, classCode, subject, courseYear, description, teacherId, day, time, room } = body;

    if (!name || !classCode || !subject || !day || !time || !room) {
      console.error('Missing required fields:', { name, classCode, subject, day, time, room });
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if classCode is already taken by another class
    const existingClass = await Class.findOne({ classCode, _id: { $ne: classId } });
    if (existingClass) {
      return NextResponse.json(
        { success: false, error: 'Class code already in use' },
        { status: 400 }
      );
    }

    // Update the class
    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      { 
        name, 
        classCode, 
        subject, 
        courseYear, 
        description, 
        teacherId, 
        day, 
        time, 
        room 
      },
      { new: true, runValidators: true }
    );

    if (!updatedClass) {
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Class updated successfully',
      data: {
        id: updatedClass._id.toString(),
        name: updatedClass.name,
        classCode: updatedClass.classCode,
        subject: updatedClass.subject,
        courseYear: updatedClass.courseYear,
        description: updatedClass.description,
        teacherId: updatedClass.teacherId,
        day: updatedClass.day,
        time: updatedClass.time,
        room: updatedClass.room
      }
    });
  } catch (error) {
    console.error('Error updating class:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update class' },
      { status: 500 }
    );
  }
}
