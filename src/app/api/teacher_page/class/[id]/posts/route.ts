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
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teacher_page/class/[id]/posts
 * Create a new post in the class feed (teacher)
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
    const body = await request.json();
    const { content, attachments } = body;

    // Validate required fields
    if (!content?.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Post content or attachments are required' },
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

    // Create new post
    const newPost = classDoc.addPost(
      authResult.userId,
      authorName,
      content?.trim() || '',
      undefined, // no avatar for now
      false // not pinned
    );

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      // Validate and add attachments
      for (const attachment of attachments) {
        if (!attachment.id || !attachment.name || !attachment.url || !attachment.size || !attachment.type) {
          return NextResponse.json(
            { error: 'Invalid attachment data' },
            { status: 400 }
          );
        }
        
        newPost.attachments.push({
          id: attachment.id,
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
          url: attachment.url,
          mimeType: attachment.mimeType,
          cloudinaryPublicId: attachment.cloudinaryPublicId
        });
      }
    }

    await classDoc.save();

    return NextResponse.json({
      success: true,
      data: {
        post: {
          id: newPost.id,
          author: newPost.authorName,
          timestamp: newPost.createdAt,
          content: newPost.body,
          attachments: newPost.attachments || [],
          comments: newPost.comments || []
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create post',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/teacher_page/class/[id]/posts
 * Get all posts in the class feed (teacher view)
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

    // Find the class and verify teacher owns it
    const classDoc = await Class.findById(classId).select('posts teacherId');
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

    // Transform posts for frontend
    const posts = (classDoc.posts || []).map((post: any) => ({
      id: post.id,
      author: post.authorName,
      timestamp: post.createdAt,
      content: post.body,
      attachments: post.attachments || [],
      comments: (post.comments || []).map((comment: any) => ({
        id: comment.id,
        author: comment.authorName,
        timestamp: comment.createdAt,
        text: comment.text
      }))
    }));

    return NextResponse.json({
      success: true,
      data: { posts }
    });

  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}