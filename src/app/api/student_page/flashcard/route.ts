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
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose'; 

//Custom Modules
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt';
import { logger } from '@/lib/winston';
import config from '@/lib/config';
import { connectToDatabase } from '@/lib/mongoose';
import { validateEmail, validatePassword } from '@/lib/middleware/validation';


//Models
import User from '@/models/user';
import Flashcard from '@/models/flashcard';
import Token from '@/models/token';

//Types
import type { IUser } from '@/models/user';
import { access } from 'fs';


export const GET = async (request: NextRequest) => {
    try {
        // Getting the user ID from the query parameters
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        // Checking if the user ID is provided and valid
        if (!userId || !Types.ObjectId.isValid(userId)) {
            return NextResponse.json(
                {
                    code: 'VALIDATION_ERROR',
                    message: 'User ID is required and must be valid',
                },
                { status: 400 }
            );
        }

        await connectToDatabase();
        
        // Fetching the user details from the database
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return NextResponse.json(
                {
                    code: 'NOT_FOUND',
                    message: 'User not found',
                },
                { status: 404 }
            );
        }

        // Fetch flashcards with cards populated
        const flashcards = await Flashcard.find({ user: new Types.ObjectId(userId) });

        // Debug: Log subjects
        logger.info(`GET /flashcard: Found ${flashcards.length} flashcards for user ${userId}`);
        flashcards.forEach((fc, idx) => {
            logger.info(`  Flashcard ${idx + 1}: "${fc.title}" - Subject: "${fc.subject || 'MISSING'}"`);
        });

        return new NextResponse(JSON.stringify({ flashcards }), {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        });

    } catch (error) {
        // Log the error for debugging
        logger.error('Error in GET /flashcard:', { error });
        return NextResponse.json(
            {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
            },
            { status: 500 }
        );
    }
};

export const POST = async (request: NextRequest) => {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        const { 
            title, 
            description,
            cards, 
            folder, 
            difficulty, 
            image,
            tags,
            subject,
            accessType, 
            sharingMode,
            password, 
            linkRole,
            publicRole,
            sharedUsers
        } = await request.json();

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return NextResponse.json(
                {
                    code: 'VALIDATION_ERROR',
                    message: 'User ID is required and must be valid',
                },
                { status: 400 }
            );
        }

        if (!Array.isArray(cards) || cards.length === 0) {
            return NextResponse.json(
                {
                    code: 'VALIDATION_ERROR',
                    message: 'At least one card is required',
                },
                { status: 400 }
            );
        }

        for (const card of cards) {
            if (!card.question || !card.answer) {
                return NextResponse.json(
                    {
                        code: 'VALIDATION_ERROR',
                        message: 'Each card must have a question and an answer',
                    },
                    { status: 400 }
                );
            }
        }



        await connectToDatabase();

        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json(
                {
                    code: 'NOT_FOUND',
                    message: 'User not found',
                },
                { status: 404 }
            );
        }

        // Prepare shared users array - always include creator as editor
        let processedSharedUsers = [{
            user: new Types.ObjectId(userId),
            role: 'editor' as const,
            addedAt: new Date()
        }];

        // Add additional shared users if sharingMode is restricted
        if (sharingMode === 'restricted' && Array.isArray(sharedUsers)) {
            for (const sharedUser of sharedUsers) {
                if (sharedUser.user && Types.ObjectId.isValid(sharedUser.user) && 
                    sharedUser.user !== userId) { // Don't duplicate the creator
                    processedSharedUsers.push({
                        user: new Types.ObjectId(sharedUser.user),
                        role: sharedUser.role || 'viewer',
                        addedAt: new Date()
                    });
                }
            }
        }
        
        // Validate and log subject for debugging
        const trimmedSubject = subject && typeof subject === 'string' ? subject.trim() : '';
        
        if (trimmedSubject) {
            logger.info(`✅ Creating flashcard with subject: "${trimmedSubject}" for user: ${userId}`);
        } else {
            logger.warn(`⚠️ Creating flashcard WITHOUT subject for user: ${userId}. Title: "${title}". Received subject value:`, subject);
        }

        const newFlashcard = new Flashcard({
            title,
            description,
            cards,
            folder: folder ? new Types.ObjectId(folder) : undefined,
            difficulty,
            image,
            tags,
            subject: trimmedSubject || undefined,
            accessType: accessType || 'private',
            sharingMode: sharingMode || undefined, // Only set if sharing is enabled
            password: password ? await bcrypt.hash(password, 10) : undefined,
            linkRole: linkRole || 'viewer',
            publicRole: publicRole || 'viewer',
            sharedUsers: sharingMode === 'restricted' ? processedSharedUsers : 
                        (accessType === 'private' ? processedSharedUsers : []),
            user: new Types.ObjectId(userId),
        });

        await newFlashcard.save();
        
        logger.info(`Flashcard created successfully. ID: ${newFlashcard._id}, Subject: ${newFlashcard.subject || 'NONE'}`);

        return new NextResponse(JSON.stringify({ 
            message: "Flashcard created successfully",
            flashcard: newFlashcard 
        }), {
            status: 201,
        });

    } catch (error) {
        logger.error('Error in POST /flashcard:', { error });
        return NextResponse.json(
            {
                code: 'Error in creating flashcard',
                message: 'An unexpected error occurred',
            },
            { status: 500 }
        );
    }
};