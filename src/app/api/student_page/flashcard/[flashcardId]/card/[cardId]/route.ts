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

export const PATCH = async (request: NextRequest, context: {params: any}) => {
    const { flashcardId, cardId } = await context.params;

    try {
        const body = await request.json();
        const { question, answer, image } = body;

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

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

        if (!cardId || !Types.ObjectId.isValid(cardId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Card ID is required and must be valid',
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

        const flashcard = await Flashcard.findOne({
            _id: flashcardId,
            user: userId
        });

        if (!flashcard) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Flashcard not found or not authorized to modify',
            }, { status: 404 });
        }

        const card = flashcard.cards.id(cardId);
        if (!card) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Card not found in this flashcard',
            }, { status: 404 });
        }

        // Update the card
        card.question = question;
        card.answer = answer;
        if (image !== undefined) card.image = image;

        await flashcard.save();

        return NextResponse.json({ 
            message: 'Card updated successfully',
            flashcard: flashcard
        }, { status: 200 });

    } catch (error: any) {
        logger.error('Error occurred while updating card:', error);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update card' 
        }, { status: 500 });
    }
}

export const DELETE = async (request: NextRequest, context: {params: any}) => {
    const { flashcardId, cardId } = await context.params;

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

        // Checking if the card ID is provided and valid
        if (!cardId || !Types.ObjectId.isValid(cardId)) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Card ID is required and must be valid',
            }, { status: 400 });
        }

        await connectToDatabase();

        // Fetching the user details from the database
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'User not found',
            }, { status: 404 });
        }

        // Check if flashcard exists and belongs to user
        const flashcard = await Flashcard.findOne({
            _id: flashcardId,
            user: userId
        });

        if (!flashcard) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Flashcard not found or not authorized to modify',
            }, { status: 404 });
        }

        // Check if card exists in the flashcard
        const cardExists = flashcard.cards.id(cardId);
        
        if (!cardExists) {
            return NextResponse.json({
                code: 'NOT_FOUND',
                message: 'Card not found in this flashcard',
            }, { status: 404 });
        }

        // Remove the specific card from the flashcard
        const updatedFlashcard = await Flashcard.findByIdAndUpdate(
            flashcardId,
            { 
                $pull: { 
                    cards: { _id: cardId } 
                } 
            },
            { new: true }
        );

        if (!updatedFlashcard) {
            return NextResponse.json({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete card',
            }, { status: 500 });
        }

        return NextResponse.json({ 
            message: 'Card deleted successfully',
            flashcard: updatedFlashcard
        }, { status: 200 });

    } catch (error: any) {
        logger.error('Error occurred while deleting card:', error);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete card' 
        }, { status: 500 });
    }
}