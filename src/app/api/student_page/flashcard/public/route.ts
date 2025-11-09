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

//Custom Modules
import { logger } from '@/lib/winston';
import { connectToDatabase } from '@/lib/mongoose';

//Models
import Flashcard from '@/models/flashcard';

export const GET = async (request: NextRequest) => {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const search = searchParams.get('search');
        const sortBy = searchParams.get('sortBy') || 'recent';

        await connectToDatabase();

        // Build query for public flashcards
        let query: any = { accessType: 'public' };

        // Add category filter if provided
        if (category) {
            query.category = category;
        }

        // Add search filter if provided
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort options
        let sort: any = {};
        switch (sortBy) {
            case 'alphabetical':
                sort = { title: 1 };
                break;
            case 'popular':
                sort = { studyCount: -1 };
                break;
            case 'recent':
            default:
                sort = { createdAt: -1 };
                break;
        }

        // Fetch public flashcards with user information
        const flashcards = await Flashcard.find(query)
            .populate('user', 'username')
            .sort(sort)
            .lean();

        // Transform to match the expected PublicDeck interface
        const decks = flashcards.map((flashcard: any) => ({
            _id: flashcard._id.toString(),
            title: flashcard.title,
            description: flashcard.description,
            category: flashcard.category || flashcard.tags?.[0], // Use first tag as category if no category
            cardCount: flashcard.cards?.length || 0,
            createdAt: flashcard.createdAt,
            coverImage: flashcard.image,
            author: {
                _id: flashcard.user?._id?.toString() || '',
                username: flashcard.user?.username || 'Unknown'
            },
            studyCount: flashcard.studyCount || 0,
            rating: flashcard.rating
        }));

        return NextResponse.json(decks, { status: 200 });

    } catch (error: any) {
        logger.error('Error occurred while fetching public flashcards:', error);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch public flashcards' 
        }, { status: 500 });
    }
}
