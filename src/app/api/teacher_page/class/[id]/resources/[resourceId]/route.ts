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
import { promises as fs } from 'fs';

//CUSTOM MODULES
import { connectToDatabase } from '@/lib/mongoose';
import Class from '@/models/class';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';

interface RouteParams {
  params: Promise<{ id: string; resourceId: string }>;
}

/**
 * DELETE /api/teacher_page/class/[id]/resources/[resourceId]
 * Delete a resource and its file
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id: classId, resourceId } = await params;

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

    // Find the resource
    const resourceIndex = classDoc.resources.findIndex((r: any) => r.id === resourceId);
    if (resourceIndex === -1) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    const resource = classDoc.resources[resourceIndex];

    // Delete the file from disk if it exists
    if (resource.filePath) {
      try {
        await fs.unlink(resource.filePath);
        console.log(`File deleted: ${resource.filePath}`);
      } catch (error) {
        console.warn(`Failed to delete file: ${resource.filePath}`, error);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Remove the resource from the database
    classDoc.resources.splice(resourceIndex, 1);
    await classDoc.save();

    return NextResponse.json({
      success: true,
      data: { 
        message: 'Resource deleted successfully'
      }
    });

  } catch (error) {
    console.error('Error deleting resource:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}