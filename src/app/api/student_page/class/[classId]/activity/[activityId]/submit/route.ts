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

interface RouteParams {
  params: Promise<{ classId: string; activityId: string }>;
}

/**
 * POST /api/student_page/class/[classId]/activity/[activityId]/submit
 * Submit an activity with file attachments
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Authorize student role
    const authzResult = await authorize(authResult.userId, ['student']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    await connectToDatabase();

    const { classId, activityId } = await params;
    const body = await request.json();
    const { files, comment } = body;

    // Validate required fields
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'At least one file is required for submission' },
        { status: 400 }
      );
    }

    // Validate file data structure
    for (const file of files) {
      if (!file.name || !file.url || !file.type || typeof file.size !== 'number') {
        return NextResponse.json(
          { error: 'Invalid file data structure. Each file must have name, url, type, and size.' },
          { status: 400 }
        );
      }
    }

    // Check if student already has a submission for this activity
    const existingSubmission = await Submission.findOne({
      studentId: authResult.userId,
      assessmentId: activityId,
      classId: classId
    });

    if (existingSubmission) {
      // Update existing submission
      existingSubmission.files = files;
      existingSubmission.comment = comment || '';
      existingSubmission.submittedAt = new Date();
      existingSubmission.status = 'submitted';
      existingSubmission.type = 'file_submission'; // Ensure type is set
      
      // Reset grading status when student resubmits - teacher needs to re-grade
      existingSubmission.score = undefined;
      existingSubmission.maxScore = undefined;
      existingSubmission.feedback = undefined;
      existingSubmission.gradedAt = undefined;
      existingSubmission.gradedBy = undefined;
      
      const savedSubmission = await existingSubmission.save();

      return NextResponse.json({
        success: true,
        data: {
          submission: {
            id: savedSubmission._id,
            activityId: activityId,
            files: savedSubmission.files,
            comment: savedSubmission.comment,
            submittedAt: savedSubmission.submittedAt,
            status: savedSubmission.status
          }
        }
      });
    } else {
      // Create new submission
      const submissionData = {
        studentId: authResult.userId,
        assessmentId: activityId,
        classId: classId,
        files: files,
        comment: comment || '',
        submittedAt: new Date(),
        status: 'submitted',
        type: 'file_submission',
        attemptNumber: 1
      };

      console.log('Creating new submission with data:', submissionData);
      
      const newSubmission = new Submission(submissionData);
      const savedSubmission = await newSubmission.save();

      return NextResponse.json({
        success: true,
        data: {
          submission: {
            id: savedSubmission._id,
            activityId: activityId,
            files: savedSubmission.files,
            comment: savedSubmission.comment,
            submittedAt: savedSubmission.submittedAt,
            status: savedSubmission.status
          }
        }
      }, { status: 201 });
    }

  } catch (error) {
    console.error('Error submitting activity:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to submit activity',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.name : 'UnknownError'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/student_page/class/[classId]/activity/[activityId]/submit
 * Get student's submission for an activity and teacher's attachments
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Authorize student role
    const authzResult = await authorize(authResult.userId, ['student']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    await connectToDatabase();

    const { classId, activityId } = await params;

    console.log('🔍 GET request for submission:', { 
      userId: authResult.userId, 
      classId, 
      activityId 
    });

    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(activityId)) {
      console.log('❌ Invalid activityId format:', activityId);
      return NextResponse.json(
        { error: 'Invalid activity ID format' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      console.log('❌ Invalid classId format:', classId);
      return NextResponse.json(
        { error: 'Invalid class ID format' },
        { status: 400 }
      );
    }

    // Find student's submission for this activity
    const submission = await Submission.findOne({
      studentId: authResult.userId,
      assessmentId: activityId,
      classId: classId
    }).lean() as any;

    console.log('📋 Found submission:', submission);

    // Fetch teacher's attachments and assessment meta (including total points) for this activity
    const assessment = await Assessment.findOne({
      _id: activityId,
      classId: classId
    }).select('attachments title instructions totalPoints points').lean() as any;

    console.log('📚 Found assessment:', assessment);
    console.log('📚 Assessment attachments:', assessment?.attachments?.length || 0, 'attachments');

    const response = {
      success: true,
      data: {
        submission: submission ? {
          id: submission._id,
          activityId: activityId,
          files: submission.files || [],
          comment: submission.comment || '',
          submittedAt: submission.submittedAt,
          status: submission.status,
          grade: submission.grade,
          // canonical numeric score and maxScore (if teacher graded)
          score: submission.score,
          maxScore: submission.maxScore,
          feedback: submission.feedback
        } : null,
        teacherAttachments: assessment?.attachments || [],
        activityInfo: assessment ? {
          title: assessment.title,
          instructions: assessment.instructions,
          // Prefer canonical totalPoints, fall back to legacy points then default to 100
          totalPoints: (assessment && assessment.totalPoints !== undefined && assessment.totalPoints !== null)
            ? assessment.totalPoints
            : (assessment?.points || 100)
        } : null
      }
    };

    console.log('🚀 Sending response:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/student_page/class/[classId]/activity/[activityId]/submit
 * Delete a file from student's submission
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Authorize student role
    const authzResult = await authorize(authResult.userId, ['student']);
    if (authzResult !== true) {
      return authzResult as Response;
    }

    await connectToDatabase();

    const { classId, activityId } = await params;
    const { searchParams } = new URL(request.url);
    const fileIndex = searchParams.get('fileIndex');

    if (fileIndex === null) {
      return NextResponse.json(
        { error: 'File index is required' },
        { status: 400 }
      );
    }

    // Find and update submission
    const submission = await Submission.findOne({
      studentId: authResult.userId,
      assessmentId: activityId,
      classId: classId
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    const index = parseInt(fileIndex);
    if (index < 0 || index >= submission.files.length) {
      return NextResponse.json(
        { error: 'Invalid file index' },
        { status: 400 }
      );
    }

    // Remove file from submission
    submission.files.splice(index, 1);
    
    // If no files left, delete the submission entirely so it shows as "Missing" in teacher panel
    if (submission.files.length === 0) {
      await Submission.deleteOne({ _id: submission._id });
      
      return NextResponse.json({
        success: true,
        data: { 
          message: 'File removed successfully. Submission deleted as no files remain.',
          remainingFiles: 0,
          submissionDeleted: true
        }
      });
    }

    await submission.save();

    return NextResponse.json({
      success: true,
      data: { 
        message: 'File removed successfully',
        remainingFiles: submission.files.length
      }
    });

  } catch (error) {
    console.error('Error deleting file from submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}