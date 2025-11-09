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
        if (!flashcardId || !Types.ObjectId.isValid(flashcardId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Flashcard ID is required and must be valid',
            }, { status: 400 });
        }

        await connectToDatabase();

        // Find the flashcard and populate user information
        const flashcard = await Flashcard.findOne({
            _id: flashcardId,
            accessType: 'public' // Only allow access to public flashcards
        }).populate('user', 'username email');

        if (!flashcard) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Public flashcard not found',
            }, { status: 404 });
        }

        return NextResponse.json({ 
            flashcard: flashcard 
        }, { status: 200 });

    } catch (error:any) {
        logger.error('Error occurred while fetching public flashcard:', error);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch public flashcard' 
        }, { status: 500 });
    }
}
