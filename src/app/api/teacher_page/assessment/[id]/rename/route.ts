/*
 * Rename assessment
 */
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;
    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) return authzResult as Response;

    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();
    const { title } = body;
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }

    const assessment = await Assessment.findOne({ _id: id, teacherId: authResult.userId.toString() });
    if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });

    assessment.title = title;
    await assessment.save();

    return NextResponse.json({ success: true, data: { assessment } });
  } catch (err) {
    console.error('Rename error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
