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
import { connectToDatabase } from '@/lib/mongoose';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';
import Class from '@/models/class';

interface RouteParams {
    params: Promise<{ studentId: string }>;
}

/**
 * GET /api/teacher_page/student/[studentId]/classes
 * Get classes that a student is enrolled in (teacher access only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        // Authenticate the user
        const authResult = await authenticate(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        // Authorize teacher role
        const authzResult = await authorize(authResult.userId, ['teacher']);
        if (authzResult !== true) {
            return authzResult as Response;
        }

        await connectToDatabase();

        const { studentId } = await params;

        // Find all classes where this teacher teaches and this student is enrolled
        const classes = await Class.find({
            teacherId: authResult.userId.toString(),
            'students.studentId': studentId,
            'students.status': 'active'
        }).select('_id name code students.$.studentId students.$.enrolledAt').lean();

        const studentClasses = classes.map((classDoc: any) => {
            const student = classDoc.students.find((s: any) => s.studentId === studentId);
            return {
                classId: classDoc._id.toString(),
                className: classDoc.name,
                classCode: classDoc.code,
                studentclassId: `${studentId}_${classDoc._id}`, // Generate consistent studentclassId
                enrolledAt: student?.enrolledAt
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                classes: studentClasses
            }
        });

    } catch (error) {
        console.error('Error fetching student classes:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}