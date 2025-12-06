import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * POST /api/teacher_page/assessment/[id]/publish
 * Publish or unpublish an assessment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { published } = await request.json();

    // First find the assessment to check if it has an access code
    const existingAssessment = await Assessment.findOne({
      _id: assessmentId,
      teacherId: authResult.userId.toString()
    }).lean() as any;

    if (!existingAssessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Prepare update object
    const updateData: any = { published: published };
    
    // When publishing, lock by default
    if (published && existingAssessment.isLocked === undefined) {
      updateData.isLocked = true;
    }

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

    return NextResponse.json({
      success: true,
      data: {
        assessmentId: assessment._id.toString(),
        published: assessment.published,
        isLocked: assessment.isLocked
      }
    });

  } catch (error: any) {
    console.error('Error publishing assessment:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error message:', error?.message);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}