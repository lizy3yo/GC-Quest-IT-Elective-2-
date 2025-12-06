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
import { Types } from 'mongoose'; 

//Custom Modules
import { logger } from '@/lib/winston';
import { connectToDatabase } from '@/lib/mongoose';

//Models
import User from '@/models/user';
import Flashcard from '@/models/flashcard';

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

        // For shared flashcards, check if the flashcard is accessible to the user
        // This includes: owner, public flashcards, or shared with the user
        const flashcard = await Flashcard.findOne({
            _id: flashcardId,
            $or: [
                { user: userId }, // Owner
                { accessType: 'public' }, // Public flashcard
                { 'sharedUsers.user': userId, 'sharedUsers.status': 'accepted' }, // Shared with user
            ]
        });

        if (!flashcard) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Flashcard not found or you do not have access',
            }, { status: 404 });
        }

        return NextResponse.json({ 
            flashcard: flashcard 
        }, { status: 200 });

    } catch (error:any) {
        logger.error('Error occurred while fetching shared flashcard:', error);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch flashcard' 
        }, { status: 500 });
    }
}
