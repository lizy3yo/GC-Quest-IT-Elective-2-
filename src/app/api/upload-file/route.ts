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
import { UploadImage, UploadFile } from '../../lib/upload';
import { connectToDatabase } from '@/lib/mongoose';

export async function POST(request: NextRequest) {
    await connectToDatabase();

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file size (10MB limit for Cloudinary free plan)
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxFileSize) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: 'File size too large', 
                    details: `File size is ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum allowed size is 10MB. Please compress your file or choose a smaller one.`
                },
                { status: 400 }
            );
        }

        // Validate file name length
        if (file.name.length > 255) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: 'File name too long', 
                    details: 'File name must be less than 255 characters. Please rename your file.'
                },
                { status: 400 }
            );
        }

        console.log('Uploading file to Cloudinary:', {
            name: file.name,
            size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            type: file.type
        });

        // Upload to cloudinary using the proper file upload method
        const uploadResult = await UploadFile(file, 'file-upload') as any;
        console.log("File uploaded:", uploadResult);

        if (uploadResult && uploadResult.secure_url) {
            return NextResponse.json({
                success: true,
                data: {
                    url: uploadResult.secure_url,
                    public_id: uploadResult.public_id,
                    resource_type: uploadResult.resource_type,
                    format: uploadResult.format,
                    bytes: uploadResult.bytes,
                    original_filename: uploadResult.original_filename || file.name,
                    display_name: uploadResult.display_name || file.name
                }
            });
        } else {
            throw new Error('Upload failed - no secure URL returned');
        }
    } catch (error) {
        console.error('File upload error:', error);
        
        // Handle specific Cloudinary errors
        if (error instanceof Error) {
            if (error.message.includes('file size') || error.message.includes('File size')) {
                return NextResponse.json(
                    { 
                        success: false, 
                        error: 'File size too large',
                        details: 'File exceeds the 10MB limit. Please compress your file or choose a smaller one.'
                    },
                    { status: 400 }
                );
            }
            
            if (error.message.includes('Invalid file type') || error.message.includes('file type')) {
                return NextResponse.json(
                    { 
                        success: false, 
                        error: 'Invalid file type',
                        details: 'File type not supported. Please use PDF, Word, Excel, PowerPoint, or image files.'
                    },
                    { status: 400 }
                );
            }
            
            if (error.name === 'FileSizeError' || error.name === 'FileTypeError') {
                return NextResponse.json(
                    { 
                        success: false, 
                        error: error.message,
                        details: 'Please check your file size and type requirements.'
                    },
                    { status: 400 }
                );
            }
        }
        
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to upload file',
                details: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        );
    }
}
    
