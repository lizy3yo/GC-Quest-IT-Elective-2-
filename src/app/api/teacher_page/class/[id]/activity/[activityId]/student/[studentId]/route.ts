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
import Submission from '@/models/submission';
import Assessment from '@/models/assessment';
import User from '@/models/user';
import Class from '@/models/class';

interface RouteParams {
    params: Promise<{ id: string; activityId: string; studentId: string }>;
}

/**
 * GET /api/teacher_page/class/[id]/activity/[activityId]/student/[studentId]
 * Get a specific student's submission for an activity
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

        const { id: classId, activityId, studentId } = await params;

        // Verify the class belongs to this teacher
        const classData = await Class.findOne({
            _id: classId,
            teacherId: authResult.userId.toString()
        }).lean();

        if (!classData) {
            return NextResponse.json({ error: 'Class not found or access denied' }, { status: 404 });
        }

        // Verify the activity/assessment exists and belongs to this class
        const assessment = await Assessment.findOne({
            _id: activityId,
            classId: classId,
            teacherId: authResult.userId.toString()
        }).lean() as any;

        if (!assessment) {
            return NextResponse.json({ error: 'Activity not found or access denied' }, { status: 404 });
        }

        // Get the student's submission
        const submission = await Submission.findOne({
            assessmentId: activityId,
            classId: classId,
            studentId: studentId
        }).lean() as any;

        // Get student information
        const student = await User.findOne({
            _id: studentId,
            role: 'student'
        }).select('_id firstName lastName email').lean() as any;

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        const studentInfo = {
            studentId: student._id.toString(),
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email
        };

            const formattedSubmission = submission ? {
                id: submission._id.toString(),
                studentId: submission.studentId,
                files: submission.files || [],
                comment: submission.comment || '',
                submittedAt: submission.submittedAt,
                status: submission.status,
                // legacy grade field kept for compatibility but prefer score/maxScore if available
                grade: submission.grade || null,
                // include numeric score and maxScore so frontends can show "score / total" consistently
                score: (submission.score !== undefined && submission.score !== null) ? submission.score : (submission.grade ?? null),
                maxScore: (submission.maxScore !== undefined && submission.maxScore !== null) ? submission.maxScore : null,
                feedback: submission.feedback || '',
                attemptNumber: submission.attemptNumber || 1,
                type: submission.type || 'file_submission'
            } : null;

        return NextResponse.json({
            success: true,
            data: {
                activity: {
                    id: assessment._id.toString(),
                    title: assessment.title,
                    description: assessment.description || '',
                    instructions: assessment.instructions || '',
                    dueDate: assessment.dueDate,
                        // Prefer the canonical `totalPoints` when present. Fall back to legacy `points`, then default to 100.
                        totalPoints: (assessment && assessment.totalPoints !== undefined && assessment.totalPoints !== null)
                            ? assessment.totalPoints
                            : (assessment?.points || 100),
                    attachments: assessment.attachments || []
                },
                student: studentInfo,
                submission: formattedSubmission
            }
        });

    } catch (error) {
        console.error('Error fetching student activity submission:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/teacher_page/class/[id]/activity/[activityId]/student/[studentId]
 * Update a student's grade for an activity
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

        const { id: classId, activityId, studentId } = await params;
        const body = await request.json();
        const { grade, feedback } = body;

        // Verify the class belongs to this teacher
        const classData = await Class.findOne({
            _id: classId,
            teacherId: authResult.userId.toString()
        }).lean();

        if (!classData) {
            return NextResponse.json({ error: 'Class not found or access denied' }, { status: 404 });
        }

        // Verify the activity/assessment exists and belongs to this class
        const assessment = await Assessment.findOne({
            _id: activityId,
            classId: classId,
            teacherId: authResult.userId.toString()
        }).lean();

        if (!assessment) {
            return NextResponse.json({ error: 'Activity not found or access denied' }, { status: 404 });
        }

        // Determine assessment total points and validate grade against it
        const assessmentAny: any = assessment;
        const assessmentTotal = (assessmentAny && assessmentAny.totalPoints !== undefined && assessmentAny.totalPoints !== null)
            ? assessmentAny.totalPoints
            : (assessmentAny?.points || 100);

        if (grade !== null && grade !== undefined) {
            if (typeof grade !== 'number' || grade < 0 || grade > assessmentTotal) {
                return NextResponse.json({ error: `Grade must be a number between 0 and ${assessmentTotal}` }, { status: 400 });
            }
        }

        // Verify the student exists
        const student = await User.findOne({
            _id: studentId,
            role: 'student'
        }).lean();

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Update or create the submission with the grade
        const updateData: any = {
            // Keep 'grade' for backward compatibility with existing UI
            grade: grade,
            // Canonical numeric score/maxScore fields used elsewhere
            score: typeof grade === 'number' ? grade : undefined,
            maxScore: assessmentTotal,
            feedback: feedback || '',
            gradedAt: new Date(),
            gradedBy: authResult.userId.toString()
        };

        // If there's a grade, mark as graded
        if (grade !== null && grade !== undefined) {
            updateData.status = 'graded';
        }

        const submission = await Submission.findOneAndUpdate(
            {
                assessmentId: activityId,
                classId: classId,
                studentId: studentId
            },
            updateData,
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        ).lean() as any;

        if (!submission) {
            return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: {
                submission: {
                    id: submission._id.toString(),
                    studentId: submission.studentId,
                    // keep 'grade' for compatibility and also provide canonical score/maxScore
                    grade: submission.grade,
                    score: submission.score,
                    maxScore: submission.maxScore,
                    feedback: submission.feedback,
                    status: submission.status,
                    gradedAt: submission.gradedAt,
                    gradedBy: submission.gradedBy
                }
            }
        });

    } catch (error) {
        console.error('Error updating student activity grade:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}