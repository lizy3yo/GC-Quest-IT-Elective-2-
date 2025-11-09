/*
 * Copyright 2025 Kharl Ryan M. De Jesus
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';
import { logger } from '@/lib/winston';

// NOTE: Replace this with real DB query once models for classwork exist.
function mockDueItems(now = new Date()) {
  const at = (offsetHours: number) => {
    const d = new Date(now);
    d.setHours(d.getHours() + offsetHours);
    return d.toISOString();
  };
  return [
    {
      _id: 'due1',
      subject: 'Computer Systems Servicing',
      classCode: 'CSS-2025-A',
      type: 'quiz',
      title: 'Peripheral Devices Basics',
      dueAt: at(2),
      link: '/student_page/student_class/CSS-2025-A?item=due1',
    },
    {
      _id: 'due2',
      subject: 'Networking 2',
      classCode: 'NET-2-B',
      type: 'activity',
      title: 'Subnetting Worksheet #3',
      dueAt: at(4),
      link: '/student_page/student_class/NET-2-B?item=due2',
    },
    {
      _id: 'due3',
      subject: 'Data Structures and Algorithms',
      classCode: 'CS-DSA-01',
      type: 'exam',
      title: 'Midterm Examination',
      dueAt: at(12),
      link: '/student_page/student_class/CS-DSA-01?item=due3',
    },
    {
      _id: 'due4',
      subject: 'English 3',
      classCode: 'ENG-3-C',
      type: 'assignment',
      title: 'Essay: Persuasive Writing',
      dueAt: at(24),
      link: '/student_page/student_class/ENG-3-C?item=due4',
    },
  ];
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult as unknown as NextResponse;
    }

    const { userId } = authResult;

    // Authorize: students, teachers, admins can view their Next Due
    const authzResult = await authorize(userId, ['student', 'teacher', 'admin']);
    if (authzResult instanceof Response) {
      return authzResult as unknown as NextResponse;
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = Math.max(1, Math.min(50, Number(limitParam) || 10));

    // TODO: Once models exist, fetch due items for this user from DB and sort by due date asc
    const items = mockDueItems()
      .filter(i => new Date(i.dueAt).getTime() >= Date.now())
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .slice(0, limit);

    return NextResponse.json({ items });
  } catch (err: unknown) {
    logger.error('Failed to fetch next due items', err);
    return NextResponse.json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch next due items',
      error: 'Internal Server Error',
    }, { status: 500 });
  }
}
