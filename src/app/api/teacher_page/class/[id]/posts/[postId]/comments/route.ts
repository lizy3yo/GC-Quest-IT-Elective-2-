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
  params: Promise<{ id: string; postId: string }>;
}

/**
 * POST /api/teacher_page/class/[id]/posts/[postId]/comments
 * Add a comment to a post (teacher)
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

    const { id: classId, postId } = await params;
    const body = await request.json();
    const { text } = body;

    // Validate required fields
    if (!text?.trim()) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      );
    }

    // Find the class and verify teacher owns it
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Check if teacher owns the class
    if (classDoc.teacherId !== authResult.userId.toString()) {
      return NextResponse.json(
        { error: 'Access denied. You are not the teacher of this class.' },
        { status: 403 }
      );
    }

    // Get teacher information
    const teacher = await User.findById(authResult.userId).select('firstName lastName email');
    const authorName = teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : 'Teacher';

    try {
      // Find the post to add comment to
      const post = classDoc.posts.find((p: any) => p.id === postId);
      if (!post) {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }

      // Create new comment object
      const newComment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        authorId: authResult.userId,
        authorName: authorName,
        authorAvatar: undefined,
        text: text.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add comment to post
      post.comments.push(newComment);
      post.commentsCount = post.comments.length;
      post.updatedAt = new Date();

      await classDoc.save();

      return NextResponse.json({
        success: true,
        data: {
          comment: {
            id: newComment.id,
            author: newComment.authorName,
            timestamp: newComment.createdAt,
            text: newComment.text
          }
        }
      }, { status: 201 });

    } catch (error: any) {
      if (error.message === 'Post not found') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}