import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * POST /api/teacher_page/assessment/[id]/lock
 * Lock or unlock an assessment manually, or set scheduled opening
 */
export async function POST(request: NextRequest, context: any) {
  const params = await context.params;
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

    const { id: assessmentId } = await params;
    const { isLocked, scheduledOpen, scheduledClose, passingScore } = await request.json();

    console.log('Lock API received:', { isLocked, scheduledOpen, scheduledClose, passingScore });

    // Prepare update object
    const updateData: any = {};
    
    if (isLocked !== undefined) {
      updateData.isLocked = isLocked;
    }
    
    if (scheduledOpen !== undefined) {
      // If setting a scheduled open time, keep it locked until that time
      updateData.scheduledOpen = scheduledOpen ? new Date(scheduledOpen) : null;
      if (scheduledOpen) {
        updateData.isLocked = true;
      }
    }
    
    if (scheduledClose !== undefined) {
      updateData.scheduledClose = scheduledClose ? new Date(scheduledClose) : null;
    }
    
    // Update passing score if provided (default to 70 if not set)
    if (passingScore !== undefined) {
      updateData.passingScore = passingScore;
    }

    console.log('Update data being saved:', updateData);

    // Update the assessment
    const assessment = await Assessment.findOneAndUpdate(
      {
        _id: assessmentId,
        teacherId: authResult.userId.toString()
      },
      updateData,
      { new: true }
    ).lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    console.log('Assessment after update:', {
      isLocked: assessment.isLocked,
      scheduledOpen: assessment.scheduledOpen,
      scheduledClose: assessment.scheduledClose
    });

    return NextResponse.json({
      success: true,
      data: {
        assessmentId: assessment._id.toString(),
        isLocked: assessment.isLocked,
        scheduledOpen: assessment.scheduledOpen,
        scheduledClose: assessment.scheduledClose,
        message: isLocked 
          ? 'Assessment locked successfully' 
          : scheduledOpen 
            ? `Assessment scheduled to open at ${new Date(scheduledOpen).toLocaleString()}`
            : scheduledClose
              ? `Assessment scheduled to close at ${new Date(scheduledClose).toLocaleString()}`
              : 'Assessment unlocked successfully'
      }
    });

  } catch (error) {
    console.error('Error updating assessment lock status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
