/*
 * Export assessment results as CSV
 */
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';
import User from '@/models/user';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function escapeCsv(value: any) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;
    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) return authzResult as Response;

    await connectToDatabase();

    const { id: assessmentId } = await params;

    const assessment = await Assessment.findOne({ _id: assessmentId, teacherId: authResult.userId.toString() }).lean();
    if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });

    const submissions = await Submission.find({ assessmentId }).sort({ submittedAt: -1 }).lean();

    // Collect unique studentIds to lookup names
    const studentIds = Array.from(new Set(submissions.map(s => s.studentId)));
    const users: any[] = await User.find({ _id: { $in: studentIds } }).select('firstName lastName email').lean();
    const userById = new Map<string, any>(users.map((u: any) => [String(u._id), u] as [string, any]));

    // Build CSV header
    const headers = ['studentId', 'firstName', 'lastName', 'email', 'attemptNumber', 'score', 'maxScore', 'status', 'submittedAt'];
    const rows = [headers.join(',')];

    for (const sub of submissions) {
      const u = userById.get(String(sub.studentId)) || ({} as any);
      const row = [
        escapeCsv(sub.studentId),
        escapeCsv(u.firstName || ''),
        escapeCsv(u.lastName || ''),
        escapeCsv(u.email || ''),
        escapeCsv(sub.attemptNumber),
        escapeCsv(sub.score ?? ''),
        escapeCsv(sub.maxScore ?? ''),
        escapeCsv(sub.status),
        escapeCsv(sub.submittedAt ? new Date(sub.submittedAt).toISOString() : '')
      ];
      rows.push(row.join(','));
    }

    const csv = rows.join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="assessment-${assessmentId}-results.csv"`
      }
    });

  } catch (err) {
    console.error('Export results error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
