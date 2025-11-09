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
import User from '@/models/user';

interface RouteParams {
  params: Promise<{ classId: string; postId: string }>;
}

/**
 * PUT /api/student_page/class/[classId]/posts/[postId]
 * Update a specific post in the class feed (student only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { classId, postId } = await params;
    const body = await request.json();
    const { content } = body;

    // Validate required fields
    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Post content is required' },
        { status: 400 }
      );
    }

    // Find the class and verify student is enrolled
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Check if student is enrolled in the class
    const isEnrolled = classDoc.students.some((student: any) => 
      student.studentId === authResult.userId.toString()
    );
    
    if (!isEnrolled) {
      return NextResponse.json(
        { error: 'Access denied. You are not enrolled in this class.' },
        { status: 403 }
      );
    }

    // Find the specific post by custom ID
    const post = classDoc.posts.find((p: any) => p.id === postId);
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Verify that the student is the author of the post
    if (post.authorId !== authResult.userId.toString()) {
      return NextResponse.json(
        { error: 'Access denied. You can only edit your own posts.' },
        { status: 403 }
      );
    }

    // Update the post content
    post.body = content.trim();
    post.updatedAt = new Date();

    await classDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        post: {
          id: post.id,
          author: post.authorName,
          timestamp: post.createdAt,
          content: post.body,
          attachments: post.attachments || [],
          comments: post.comments || [],
          updatedAt: post.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update post',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/student_page/class/[classId]/posts/[postId]
 * Delete a specific post from the class feed (student only)
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

    const { classId, postId } = await params;

    // Find the class and verify student is enrolled
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Check if student is enrolled in the class
    const isEnrolled = classDoc.students.some((student: any) => 
      student.studentId === authResult.userId.toString()
    );
    
    if (!isEnrolled) {
      return NextResponse.json(
        { error: 'Access denied. You are not enrolled in this class.' },
        { status: 403 }
      );
    }

    // Find the specific post by custom ID
    const post = classDoc.posts.find((p: any) => p.id === postId);
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Verify that the student is the author of the post
    if (post.authorId !== authResult.userId.toString()) {
      return NextResponse.json(
        { error: 'Access denied. You can only delete your own posts.' },
        { status: 403 }
      );
    }

    // Remove the post by filtering the posts array
    classDoc.posts = classDoc.posts.filter((p: any) => p.id !== postId);
    await classDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        message: 'Post deleted successfully'
      }
    });

  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete post',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}