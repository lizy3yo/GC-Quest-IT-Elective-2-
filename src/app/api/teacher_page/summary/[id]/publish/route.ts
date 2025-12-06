import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { Summary } from '@/models/summary';
import { authenticate } from '@/lib/middleware/authenticate';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    await connectToDatabase();
    const { id: summaryId } = await params;

    // Parse request body
    const body = await request.json();
    const { publish } = body;

    // Find the summary
    const summary = await Summary.findById(summaryId);
    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Summary not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (summary.userId !== authResult.userId.toString()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update publish status
    summary.isPublic = publish;
    await summary.save();

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          _id: summary._id,
          isPublic: summary.isPublic
        }
      }
    });
  } catch (error) {
    console.error('Error updating summary publish status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update publish status' },
      { status: 500 }
    );
  }
}
