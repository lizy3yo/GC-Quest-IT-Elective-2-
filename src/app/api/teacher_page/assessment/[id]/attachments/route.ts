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

//NODE MODULES
import { NextRequest, NextResponse } from 'next/server';

//CUSTOM MODULES
import { connectToDatabase } from '@/lib/mongoose';
import Assessment from '@/models/assessment';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';
import { UploadFile } from '@/app/lib/upload';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teacher_page/assessment/[id]/attachments
 * Upload an attachment file to an assessment
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { id: assessmentId } = await params;

    // Find the assessment and verify teacher ownership
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Verify the teacher owns this assessment
    if (assessment.teacherId.toString() !== authResult.userId) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not own this assessment' },
        { status: 403 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit to match Cloudinary free plan)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { 
          error: 'File size too large. Maximum 10MB allowed for assessment attachments.', 
          details: `Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB. Please compress or choose a smaller file.`
        },
        { status: 400 }
      );
    }

    // Validate file name length
    if (file.name.length > 255) {
      return NextResponse.json(
        { error: 'File name too long. Maximum 255 characters allowed.' },
        { status: 400 }
      );
    }

    console.log('Uploading assessment attachment to Cloudinary:', {
      assessmentId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Upload to Cloudinary
    const uploadResult = await UploadFile(file, `assessments/${assessmentId}/attachments`) as any;
    
    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error('Failed to upload file to Cloudinary');
    }

    console.log('Cloudinary upload successful:', {
      public_id: uploadResult.public_id,
      secure_url: uploadResult.secure_url,
      resource_type: uploadResult.resource_type,
      format: uploadResult.format,
      bytes: uploadResult.bytes
    });

    // Add attachment to assessment
    const attachment = {
      name: file.name,
      url: uploadResult.secure_url,
      type: file.type || 'application/octet-stream',
      size: uploadResult.bytes || file.size,
      cloudinaryPublicId: uploadResult.public_id,
      resourceType: uploadResult.resource_type,
      format: uploadResult.format
    };

    // Initialize attachments array if it doesn't exist
    if (!assessment.attachments) {
      assessment.attachments = [];
    }

    assessment.attachments.push(attachment);
    await assessment.save();

    return NextResponse.json({
      success: true,
      data: { 
        attachment: {
          name: attachment.name,
          url: attachment.url,
          type: attachment.type,
          size: attachment.size
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error uploading assessment attachment:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to upload attachment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/teacher_page/assessment/[id]/attachments
 * Get all attachments for an assessment
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

    const { id: assessmentId } = await params;

    // Find the assessment and verify teacher ownership
    const assessment = await Assessment.findById(assessmentId).select('attachments teacherId');
    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Verify the teacher owns this assessment
    if (assessment.teacherId.toString() !== authResult.userId) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not own this assessment' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { 
        attachments: assessment.attachments || []
      }
    });

  } catch (error) {
    console.error('Error fetching assessment attachments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}