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
import Class from '@/models/class';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';
import { UploadFile } from '@/app/lib/upload';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teacher_page/class/[id]/resources
 * Upload a resource file to a class
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

    const { id: classId } = await params;

    // Find the class and verify teacher ownership
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Verify the teacher owns this class
    if (classDoc.teacherId.toString() !== authResult.userId) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not own this class' },
        { status: 403 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;

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
          error: 'File size too large. Maximum 10MB allowed.', 
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

    // Validate description length
    if (description && description.length > 500) {
      return NextResponse.json(
        { error: 'Description too long. Maximum 500 characters allowed.' },
        { status: 400 }
      );
    }

    // Upload file to Cloudinary
    const fileType = file.type || 'application/octet-stream';
    const fileExtension = file.name.split('.').pop() || 'file';
    
    console.log('Uploading file to Cloudinary:', {
      name: file.name,
      size: file.size,
      type: fileType,
      extension: fileExtension,
      description: description?.substring(0, 50) + (description && description.length > 50 ? '...' : '')
    });

    // Upload to Cloudinary
    const uploadResult = await UploadFile(file, `classes/${classId}/resources`) as any;
    
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

    // Ensure file type isn't too long
    const validatedType = fileExtension.length > 50 ? fileExtension.substring(0, 50) : fileExtension;
    
    // Add resource to class using the class model method
    const resource = classDoc.addResource(
      file.name,
      validatedType,
      authResult.userId,
      {
        url: uploadResult.secure_url, // Store the Cloudinary URL for download
        cloudinaryPublicId: uploadResult.public_id, // Store public ID for future operations
        description: description || '',
        sizeBytes: uploadResult.bytes || file.size,
        resourceType: uploadResult.resource_type,
        format: uploadResult.format
      }
    );

    console.log('Resource added, about to save...');
    await classDoc.save();
    console.log('Document saved successfully');

    return NextResponse.json({
      success: true,
      data: { 
        resource: {
          id: resource.id,
          name: resource.name,
          type: resource.type,
          url: resource.url,
          description: resource.description,
          sizeBytes: resource.sizeBytes,
          uploadedAt: resource.uploadedAt,
          uploadedBy: resource.uploadedBy
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error uploading resource:', error);
    
    if (error instanceof Error) {
      if (error.name === 'ValidationError') {
        // Extract more specific validation error details
        const validationDetails = error.message;
        console.error('Validation details:', validationDetails);
        
        return NextResponse.json(
          { 
            error: 'Validation error', 
            details: validationDetails,
            message: 'The uploaded file data exceeds the allowed limits. Please try a smaller file.'
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/teacher_page/class/[id]/resources
 * Get all resources for a class
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

    const { id: classId } = await params;

    // Find the class and verify teacher ownership
    const classDoc = await Class.findById(classId).select('resources teacherId');
    if (!classDoc) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Verify the teacher owns this class
    if (classDoc.teacherId.toString() !== authResult.userId) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not own this class' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { 
        resources: classDoc.resources || []
      }
    });

  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}