import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

/**
 * POST /api/teacher_page/assessment/[id]/regenerate-code
 * Regenerate access code for an assessment
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

    // Generate new access code
    const newAccessCode = generateAccessCode();

    // Update the assessment
    const assessment = await Assessment.findOneAndUpdate(
      {
        _id: assessmentId,
        teacherId: authResult.userId.toString()
      },
      {
        accessCode: newAccessCode,
        published: true // Ensure it's published when regenerating code
      },
      { new: true }
    ).lean() as any;

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        assessmentId: assessment._id.toString(),
        accessCode: assessment.accessCode,
        published: assessment.published
      }
    });

  } catch (error) {
    console.error('Error regenerating access code:', error);
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