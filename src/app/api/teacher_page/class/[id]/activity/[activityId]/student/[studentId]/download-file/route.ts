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
import path from 'path';
import { connectToDatabase } from '@/lib/mongoose';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';
import Submission from '@/models/submission';
import Assessment from '@/models/assessment';
import Class from '@/models/class';

interface RouteParams {
    params: Promise<{ id: string; activityId: string; studentId: string }>;
}

/**
 * POST /api/teacher_page/class/[id]/activity/[activityId]/student/[studentId]/download-file
 * Securely download a file from a student's submission
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        console.log('Teacher file download request received');
        
        // Authenticate the user
        const authResult = await authenticate(request);
        if (authResult instanceof Response) {
            console.log('Authentication failed');
            return authResult;
        }

        // Authorize teacher role
        const authzResult = await authorize(authResult.userId, ['teacher']);
        if (authzResult !== true) {
            console.log('Authorization failed');
            return authzResult as Response;
        }

        await connectToDatabase();

        const { id: classId, activityId, studentId } = await params;
        const body = await request.json();
        const { fileName, fileUrl, fileType, cloudinaryPublicId, studentclassId } = body;

        console.log('Download request params:', { 
            classId, 
            activityId, 
            studentId, 
            fileName, 
            studentclassId: studentclassId || 'not provided'
        });

        // Verify the class belongs to this teacher
        const classData = await Class.findOne({
            _id: classId,
            teacherId: authResult.userId.toString()
        }).lean();

        if (!classData) {
            console.log('Class not found or access denied');
            return NextResponse.json({ error: 'Class not found or access denied' }, { status: 404 });
        }

        // Verify the activity/assessment exists and belongs to this class
        const assessment = await Assessment.findOne({
            _id: activityId,
            classId: classId,
            teacherId: authResult.userId.toString()
        }).lean();

        if (!assessment) {
            console.log('Activity not found or access denied');
            return NextResponse.json({ error: 'Activity not found or access denied' }, { status: 404 });
        }

        // Get the student's submission to verify the file belongs to this submission
        const submission = await Submission.findOne({
            assessmentId: activityId,
            classId: classId,
            studentId: studentId
        }).lean() as any;

        if (!submission) {
            console.log('Submission not found');
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        // Verify the file exists in the submission
        const fileExists = submission.files?.some((file: any) => 
            file.name === fileName && file.url === fileUrl
        );

        if (!fileExists) {
            console.log('File not found in submission');
            return NextResponse.json({ error: 'File not found in submission' }, { status: 404 });
        }

        // Check if file URL exists (Cloudinary)
        if (!fileUrl) {
            console.log('File URL not found');
            return NextResponse.json(
                { 
                    error: 'File not available from cloud storage', 
                    details: 'This file does not have a valid download URL.'
                },
                { status: 404 }
            );
        }

        // Use the original URL and add attachment flag for download
        let downloadUrl = fileUrl;
        console.log('Original URL:', downloadUrl);
        
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
                ok: fileResponse.ok
            });
            
            if (!fileResponse.ok) {
                throw new Error(`Cloudinary fetch failed: ${fileResponse.status} ${fileResponse.statusText}`);
            }
        } catch (error) {
            console.error('Failed to fetch file from Cloudinary:', error);
            
            // More specific error handling
            if (error instanceof Error && error.name === 'AbortError') {
                return NextResponse.json(
                    { 
                        error: 'Download timeout',
                        details: 'The file download timed out. Please try again.',
                        fallbackUrl: fileUrl
                    },
                    { status: 408 }
                );
            }
            
            return NextResponse.json(
                { 
                    error: 'File not available from cloud storage',
                    details: `Unable to retrieve file from cloud storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    fallbackUrl: fileUrl // Provide the URL for client-side fallback
                },
                { status: 404 }
            );
        }

        // Get file buffer from response
        const fileArrayBuffer = await fileResponse.arrayBuffer();
        const fileBuffer = Buffer.from(fileArrayBuffer);
        
        // Determine content type
        const ext = path.extname(fileName).toLowerCase();
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

        const contentType = contentTypeMap[ext] || fileType || 'application/octet-stream';

        console.log('Returning file download:', { 
            fileName, 
            contentType, 
            size: fileBuffer.length,
            studentclassId: studentclassId || 'not provided',
            context: 'teacher_submission_download'
        });

        // Return the file with proper headers
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': fileBuffer.length.toString(),
            },
        });

    } catch (error) {
        console.error('Error downloading file:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}