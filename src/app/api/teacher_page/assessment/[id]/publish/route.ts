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
    
    // Generate access code if publishing and doesn't have one
    if (published && !existingAssessment.accessCode) {
      updateData.accessCode = generateAccessCode();
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
        accessCode: assessment.accessCode
      }
    });

  } catch (error) {
    console.error('Error publishing assessment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateAccessCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}