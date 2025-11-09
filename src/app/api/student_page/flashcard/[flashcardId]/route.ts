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

export const GET = async (request: NextRequest, context: {params: any}) => {
    const { flashcardId } = await context.params;

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'User ID is required and must be valid',
            }, { status: 400 });
        }
        
        if (!flashcardId || !Types.ObjectId.isValid(flashcardId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Flashcard ID is required and must be valid',
            }, { status: 400 });
        }

        await connectToDatabase();

        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'User not found',
            }, { status: 404 });
        }  

        const flashcard = await Flashcard.findOne({_id: flashcardId, user: userId});
        if (!flashcard) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Flashcard not found',
            }, { status: 404 });
        }

        return NextResponse.json({ 
            flashcard: flashcard 
        }, { status: 200 });

    } catch (error:any) {
        logger.error('Error occurred while fetching flashcard:', error);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch flashcard' 
        }, { status: 500 });
    }
}

export const POST = async (request: NextRequest, context: {params: any}) => {
    const { flashcardId } = await context.params;

    try {
        const body = await request.json();
        const { question, answer, image } = body;

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'User ID is required and must be valid',
            }, { status: 400 });
        }
        
        if (!flashcardId || !Types.ObjectId.isValid(flashcardId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Flashcard ID is required and must be valid',
            }, { status: 400 });
        }

        if (!question || !answer) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Question and answer are required',
            }, { status: 400 });
        }

        await connectToDatabase();

        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'User not found',
            }, { status: 404 });
        }  

        const flashcard = await Flashcard.findOne({_id: flashcardId, user: userId});
        if (!flashcard) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Flashcard not found',
            }, { status: 404 });
        }

        // Add new card to the flashcard
        const newCard = {
            question,
            answer,
            image: image || undefined
        };

        flashcard.cards.push(newCard);
        await flashcard.save();

        return NextResponse.json({ 
            message: 'Card added successfully',
            flashcard: flashcard 
        }, { status: 201 });

    } catch (error:any) {
        logger.error('Error occurred while adding card:', error);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to add card' 
        }, { status: 500 });
    }
}

export const PATCH = async (request: NextRequest, context: {params: any}) => {
    const { flashcardId } = await context.params;

    try {
        const body = await request.json();
        const { 
            title, 
            description,
            cards, 
            folder, 
            difficulty, 
            image,
            tags, 
            accessType, 
            sharingMode,
            password, 
            linkRole,
            publicRole,
            sharedUsers,
            shareableLink
        } = body;

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'User ID is required and must be valid',
            }, { status: 400 });
        }
        
        if (!flashcardId || !Types.ObjectId.isValid(flashcardId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Flashcard ID is required and must be valid',
            }, { status: 400 });
        }

        await connectToDatabase();

        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'User not found',
            }, { status: 404 });
        }  

        const flashcard = await Flashcard.findOne({_id: flashcardId, user: userId});
        if (!flashcard) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Flashcard not found',
            }, { status: 404 });
        }

        if (flashcard.user.toString() !== userId) {
            return NextResponse.json({
                code: 'FORBIDDEN',
                message: 'You are not authorized to update this flashcard',
            }, { status: 403 });
        }

        // Prepare shared users array - always include creator as editor
        let processedSharedUsers: any[] = [{
            user: new Types.ObjectId(userId),
            role: 'editor' as const,
            addedAt: new Date(),
            status: 'accepted' as const
        }];

        // Add additional shared users if sharingMode is restricted
        if (sharingMode === 'restricted' && Array.isArray(sharedUsers)) {
            for (const sharedUser of sharedUsers) {
                // Handle email-based sharing
                if (sharedUser.email) {
                    processedSharedUsers.push({
                        email: sharedUser.email,
                        role: sharedUser.role || 'viewer',
                        addedAt: new Date(),
                        status: sharedUser.status || 'pending'
                    });
                }
                // Handle user ID-based sharing (existing functionality)
                else if (sharedUser.user && Types.ObjectId.isValid(sharedUser.user) && 
                    sharedUser.user !== userId) {
                    processedSharedUsers.push({
                        user: new Types.ObjectId(sharedUser.user),
                        role: sharedUser.role || 'viewer',
                        addedAt: new Date(),
                        status: sharedUser.status || 'accepted'
                    });
                }
            }
        }

        const updateData: any = {
            title,
            cards,
            description,
            folder: folder ? new Types.ObjectId(folder) : undefined,
            difficulty,
            image,
            tags,
            accessType,
            sharingMode: sharingMode || undefined,
            password: password ? await bcrypt.hash(password, 10) : undefined,
            linkRole: linkRole || 'viewer',
            publicRole: publicRole || 'viewer',
            shareableLink: shareableLink || undefined
        };

        // Handle shared users based on sharing mode
        if (sharingMode === 'restricted') {
            updateData.sharedUsers = processedSharedUsers;
        } else if (accessType === 'private') {
            updateData.sharedUsers = processedSharedUsers; // Only creator for private
        } else {
            updateData.sharedUsers = []; // Public with anyone_with_link doesn't need specific users
        }

        const updatedflashcard = await Flashcard.findByIdAndUpdate(
            flashcardId,
            updateData,
            { new: true }
        );

        if (!updatedflashcard) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Flashcard not found after update attempt',
            }, { status: 404 });
        }

        return NextResponse.json({ 
            message: 'Flashcard updated successfully', 
            flashcard: updatedflashcard 
        }, { status: 200 });

    } catch (error:any) {
        logger.error('Error occurred while updating flashcard:', error);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update flashcard' 
        }, { status: 500 });
    }
}

export const DELETE = async (request: NextRequest, context: {params: any}) => {
    const { flashcardId } = await context.params;

    try {
        // Getting the user ID from the query parameters
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId || !Types.ObjectId.isValid(userId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'User ID is required and must be valid',
            }, { status: 400 });
        }
        
        // Checking if the flashcard ID is provided and valid
        if (!flashcardId || !Types.ObjectId.isValid(flashcardId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Flashcard ID is required and must be valid',
            }, { status: 400 });
        }

        await connectToDatabase();

        // Fetching the user details from the database
        const user = await User.findById(userId);

        if (!user) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'User not found',
            }, { status: 404 });
        }

        // Delete the flashcard
        const deletedFlashcard = await Flashcard.findOneAndDelete({
            _id: flashcardId,
            user: userId
        });

        if (!deletedFlashcard) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Flashcard not found or not authorized to delete',
            }, { status: 404 });
        }

        await Flashcard.findByIdAndDelete(flashcardId);

        return NextResponse.json({ 
            message: 'Flashcard deleted successfully' 
        }, { status: 200 });

    } catch (error: unknown) {
        logger.error('Error occurred while deleting flashcard:', error);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete flashcard' 
        }, { status: 500 });
    }
}