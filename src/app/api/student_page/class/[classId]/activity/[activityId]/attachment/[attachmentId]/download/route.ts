/*
 * Copyright 2025 Kharl Ryan M. De Jesus
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance w    let downloadUrl = attachment.url;

    // Use the original URL and add attachment flag for download
    console.log('📥 Original download URL:', downloadUrl);

    try {
      // Add attachment flag to force download instead of inline display
      if (downloadUrl.includes('res.cloudinary.com') && !downloadUrl.includes('fl_attachment')) {
        // Add the attachment flag to the URL to force download
        if (downloadUrl.includes('/upload/')) {
          downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
          console.log('Added attachment flag for download:', downloadUrl);
        }
      }e License.
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
import Assessment from '@/models/assessment';

interface RouteParams {
  params: Promise<{ classId: string; activityId: string; attachmentId: string }>;
}

/**
 * GET /api/student_page/class/[classId]/activity/[activityId]/attachment/[attachmentId]/download
 * Download a teacher attachment from an activity
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

    const { classId, activityId, attachmentId } = await params;

    console.log('📥 Download attachment request:', { 
      userId: authResult.userId, 
      classId, 
      activityId, 
      attachmentId 
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

    // Find the assessment/activity and its attachments
    const assessment = await Assessment.findOne({
      _id: activityId,
      classId: classId
    }).select('attachments title').lean() as any;

    if (!assessment) {
      console.log('❌ Assessment not found:', { activityId, classId });
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    if (!assessment.attachments || assessment.attachments.length === 0) {
      console.log('❌ No attachments found for activity:', { activityId });
      return NextResponse.json(
        { error: 'No attachments found for this activity' },
        { status: 404 }
      );
    }

    // Find the specific attachment using multiple matching strategies
    let attachment = null;
    
    // Strategy 1: Try to match by index if attachmentId is numeric
    if (/^\d+$/.test(attachmentId)) {
      const index = parseInt(attachmentId);
      if (index >= 0 && index < assessment.attachments.length) {
        attachment = assessment.attachments[index];
        console.log('✅ Found attachment by index:', index);
      }
    }
    
    // Strategy 2: Try to match by URL contains pattern
    if (!attachment) {
      attachment = assessment.attachments.find((att: any) => 
        att.url && att.url.includes(attachmentId)
      );
      if (attachment) {
        console.log('✅ Found attachment by URL pattern match');
      }
    }
    
    // Strategy 3: Try to match by filename pattern
    if (!attachment) {
      attachment = assessment.attachments.find((att: any) => 
        att.name && att.name.includes(attachmentId)
      );
      if (attachment) {
        console.log('✅ Found attachment by filename pattern match');
      }
    }
    
    // Strategy 4: Try to match by creating hash from URL and comparing
    if (!attachment) {
      for (const att of assessment.attachments) {
        if (att.url) {
          const urlHash = btoa(att.url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
          if (urlHash === attachmentId) {
            attachment = att;
            console.log('✅ Found attachment by URL hash match');
            break;
          }
        }
      }
    }

    if (!attachment) {
      console.log('❌ Attachment not found with any strategy:', { 
        attachmentId, 
        availableAttachments: assessment.attachments?.length || 0,
        attachmentUrls: assessment.attachments?.map((a: any) => a.url?.split('/').pop()).slice(0, 3)
      });
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    console.log('📎 Found attachment:', {
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      url: attachment.url ? 'present' : 'missing'
    });

    // Validate that the attachment has a URL
    if (!attachment.url) {
      console.log('❌ Attachment has no URL:', { attachmentId });
      return NextResponse.json(
        { error: 'Attachment URL not available' },
        { status: 400 }
      );
    }

    let downloadUrl = attachment.url;

    // Use the original URL and add attachment flag for download
    console.log('📥 Original download URL:', downloadUrl);

    // Fix resource type for non-image files that were incorrectly uploaded as images
    if (downloadUrl.includes('/image/upload/') && attachment.type && !attachment.type.startsWith('image/')) {
      // This file was uploaded with wrong resource type, try to fix the URL
      const correctedUrl = downloadUrl.replace('/image/upload/', '/raw/upload/');
      console.log('🔧 Correcting resource type from image to raw:', correctedUrl);
      downloadUrl = correctedUrl;
    }

    // Add attachment flag to force download instead of inline display
    if (downloadUrl.includes('res.cloudinary.com') && !downloadUrl.includes('fl_attachment')) {
      // Add the attachment flag to the URL to force download
      if (downloadUrl.includes('/upload/')) {
        downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
        console.log('Added attachment flag for download:', downloadUrl);
      }
    }

    try {
      // Add timeout and better headers for the fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      // Fetch the file from Cloudinary
      const response = await fetch(downloadUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'GC-Quest/1.0',
        }
      });
      
      clearTimeout(timeoutId);
      
      console.log('Cloudinary fetch response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: downloadUrl,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        console.error('❌ Failed to fetch from Cloudinary:', {
          status: response.status,
          statusText: response.statusText,
          url: downloadUrl
        });

        // If we get 401, try multiple fallback strategies
        if (response.status === 401) {
          console.log('🔄 Trying fallback strategies for 401 error...');
          
          // Strategy 1: Try without the fl_attachment flag
          if (downloadUrl.includes('fl_attachment')) {
            console.log('🔄 Trying without fl_attachment flag...');
            const fallbackUrl = downloadUrl.replace('/upload/fl_attachment/', '/upload/');
            
            const fallbackResponse = await fetch(fallbackUrl, {
              method: 'GET',
              signal: controller.signal,
              headers: {
                'User-Agent': 'GC-Quest/1.0',
              }
            });
            
            console.log('Fallback fetch response (no fl_attachment):', {
              status: fallbackResponse.status,
              statusText: fallbackResponse.statusText,
              ok: fallbackResponse.ok,
              url: fallbackUrl
            });
            
            if (fallbackResponse.ok) {
              // Use the fallback response
              const fileBuffer = await fallbackResponse.arrayBuffer();
              const fileBlob = new Uint8Array(fileBuffer);

              console.log('✅ Successfully fetched file with fallback (no fl_attachment):', {
                name: attachment.name,
                size: fileBlob.length,
                type: attachment.type
              });

              // Set appropriate headers for file download
              const headers = new Headers();
              headers.set('Content-Type', attachment.type || 'application/octet-stream');
              headers.set('Content-Disposition', `attachment; filename="${attachment.name}"`);
              headers.set('Content-Length', fileBlob.length.toString());
              headers.set('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

              return new NextResponse(fileBlob, {
                status: 200,
                headers: headers
              });
            }
          }
          
          // Strategy 2: Try correcting resource type from image to raw (for files uploaded incorrectly)
          if (downloadUrl.includes('/image/upload/') && attachment.type && !attachment.type.startsWith('image/')) {
            console.log('🔄 Trying resource type correction (image -> raw)...');
            let rawUrl = downloadUrl.replace('/image/upload/', '/raw/upload/');
            
            // Remove fl_attachment for this attempt
            if (rawUrl.includes('fl_attachment')) {
              rawUrl = rawUrl.replace('/upload/fl_attachment/', '/upload/');
            }
            
            const rawResponse = await fetch(rawUrl, {
              method: 'GET',
              signal: controller.signal,
              headers: {
                'User-Agent': 'GC-Quest/1.0',
              }
            });
            
            console.log('Raw resource fetch response:', {
              status: rawResponse.status,
              statusText: rawResponse.statusText,
              ok: rawResponse.ok,
              url: rawUrl
            });
            
            if (rawResponse.ok) {
              // Use the raw response
              const fileBuffer = await rawResponse.arrayBuffer();
              const fileBlob = new Uint8Array(fileBuffer);

              console.log('✅ Successfully fetched file with raw resource type:', {
                name: attachment.name,
                size: fileBlob.length,
                type: attachment.type
              });

              // Set appropriate headers for file download
              const headers = new Headers();
              headers.set('Content-Type', attachment.type || 'application/octet-stream');
              headers.set('Content-Disposition', `attachment; filename="${attachment.name}"`);
              headers.set('Content-Length', fileBlob.length.toString());
              headers.set('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

              return new NextResponse(fileBlob, {
                status: 200,
                headers: headers
              });
            }
          }
        }

        if (response.status === 401) {
          return NextResponse.json(
            { 
              error: 'Unauthorized access to file',
              details: 'The file may have been moved or access permissions changed.',
              needsReupload: true,
              cloudinaryUrl: downloadUrl
            },
            { status: 401 }
          );
        }

        return NextResponse.json(
          { 
            error: `Failed to download file from cloud storage: ${response.statusText}`,
            details: `Status: ${response.status}`,
            cloudinaryUrl: downloadUrl
          },
          { status: response.status }
        );
      }

      // Get the file content
      const fileBuffer = await response.arrayBuffer();
      const fileBlob = new Uint8Array(fileBuffer);

      console.log('✅ Successfully fetched file:', {
        name: attachment.name,
        size: fileBlob.length,
        type: attachment.type
      });

      // Set appropriate headers for file download
      const headers = new Headers();
      headers.set('Content-Type', attachment.type || 'application/octet-stream');
      headers.set('Content-Disposition', `attachment; filename="${attachment.name}"`);
      headers.set('Content-Length', fileBlob.length.toString());
      headers.set('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

      return new NextResponse(fileBlob, {
        status: 200,
        headers: headers
      });

    } catch (error) {
      console.error('❌ Error downloading from Cloudinary:', error);
      
      // More specific error handling
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { 
            error: 'Download timeout',
            details: 'The file download timed out. Please try again or contact your teacher if the issue persists.'
          },
          { status: 408 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to download file from cloud storage',
          details: error instanceof Error ? error.message : 'Unknown error',
          cloudinaryUrl: downloadUrl
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error in attachment download endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}