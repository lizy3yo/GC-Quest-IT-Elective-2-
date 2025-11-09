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
import path from 'path';

//CUSTOM MODULES
import { connectToDatabase } from '@/lib/mongoose';
import Class from '@/models/class';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

interface RouteParams {
  params: Promise<{ id: string; resourceId: string }>;
}

/**
 * GET /api/teacher_page/class/[id]/resources/[resourceId]/download
 * Download a resource file with proper authentication
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    console.log('Download request received');
    
    // Authenticate the user
    const authResult = await authenticate(request);
    if (authResult instanceof Response) {
      console.log('Authentication failed');
      return authResult;
    }
    console.log('Authentication successful, userId:', authResult.userId);

    // Authorize teacher role (could be extended to allow students for their classes)
    const authzResult = await authorize(authResult.userId, ['teacher']);
    if (authzResult !== true) {
      console.log('Authorization failed');
      return authzResult as Response;
    }
    console.log('Authorization successful');

    await connectToDatabase();

    const { id: classId, resourceId } = await params;
    console.log('Request params:', { classId, resourceId });

    // Find the class and verify teacher ownership
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      console.log('Class not found:', classId);
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }
    console.log('Class found:', classDoc._id);

    // Verify the teacher owns this class
    if (classDoc.teacherId.toString() !== authResult.userId) {
      console.log('Teacher ownership verification failed:', {
        classTeacherId: classDoc.teacherId.toString(),
        requestUserId: authResult.userId
      });
      return NextResponse.json(
        { error: 'Unauthorized: You do not own this class' },
        { status: 403 }
      );
    }
    console.log('Teacher ownership verified');

    // Find the resource
    console.log('Looking for resource:', resourceId);
    console.log('Available resources:', classDoc.resources.map((r: any) => ({ id: r.id, name: r.name })));
    console.log('Full resources array:', JSON.stringify(classDoc.resources, null, 2));
    
    const resource = classDoc.resources.find((r: any) => r.id === resourceId);
    if (!resource) {
      console.log('Resource not found:', resourceId);
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }
    console.log('Resource found:', { id: resource.id, name: resource.name, filePath: resource.filePath });
    console.log('Full resource object:', JSON.stringify(resource, null, 2));

    // Check if file URL exists (Cloudinary)
    if (!resource.url) {
      console.log('File URL not found in resource');
      console.log('Resource keys:', Object.keys(resource));
      
      // If this resource doesn't have a URL, it can't be downloaded
      return NextResponse.json(
        { 
          error: 'File not available from cloud storage', 
          details: 'This resource does not have a valid download URL. Please re-upload the file.',
          needsReupload: true
        },
        { status: 404 }
      );
    }

    // Use the original URL and add attachment flag for download
    let downloadUrl = resource.url;
    console.log('Original URL:', downloadUrl);
    console.log('Stored resource type:', resource.resourceType);
    
    // Add attachment flag to force download instead of inline display
    if (downloadUrl.includes('res.cloudinary.com') && !downloadUrl.includes('fl_attachment')) {
      // Add the attachment flag to the URL to force download
      if (downloadUrl.includes('/upload/')) {
        downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
        console.log('Added attachment flag for download:', downloadUrl);
      }
    }

    // Fetch the file from Cloudinary
    console.log('Fetching file from Cloudinary:', downloadUrl);
    console.log('Resource URL type:', typeof downloadUrl);
    console.log('Resource URL length:', downloadUrl?.length);
    
    let fileResponse;
    try {
      // Add timeout and better headers for the fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      fileResponse = await fetch(downloadUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'GC-Quest/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      console.log('Cloudinary fetch response:', {
        status: fileResponse.status,
        statusText: fileResponse.statusText,
        ok: fileResponse.ok,
        headers: Object.fromEntries(fileResponse.headers.entries())
      });
      
      if (!fileResponse.ok) {
        throw new Error(`Cloudinary fetch failed: ${fileResponse.status} ${fileResponse.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch file from Cloudinary:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: error instanceof Error ? error.cause : undefined
      });
      
      // More specific error handling
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { 
            error: 'Download timeout',
            details: 'The file download timed out. Please try again or contact support if the issue persists.'
          },
          { status: 408 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'File not available from cloud storage',
          details: `Unable to retrieve file from cloud storage: ${error instanceof Error ? error.message : 'Unknown error'}. The file may have been deleted or moved.`,
          cloudinaryUrl: downloadUrl // Provide the URL for client-side fallback
        },
        { status: 404 }
      );
    }

    // Get file buffer from response
    const fileArrayBuffer = await fileResponse.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);
    
    // Determine content type
    const ext = path.extname(resource.name).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Return the file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${resource.name}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error downloading resource:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}