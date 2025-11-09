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
import { connectToDatabase } from '@/lib/mongoose';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';
import { logger } from '@/lib/winston';
import config from '@/lib/config';

//Models
import User from '@/models/user';

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();
        
        // Authenticate user
        const authResult = await authenticate(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { userId } = authResult;

        // Authorize user (admin only)
        const authzResult = await authorize(userId, ['admin']);
        if (authzResult instanceof Response) {
            return authzResult as Response;
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const offsetParam = searchParams.get('offset');

        // Validate and set defaults
        let limit = config.defaultResLimit;
        let offset = config.defaultResOffset;

        if (limitParam) {
            const parsedLimit = parseInt(limitParam);
            if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
                return NextResponse.json({
                    code: 'VALIDATION_ERROR',
                    message: 'Limit must be an integer between 1 and 100'
                }, { status: 400 });
            }
            limit = parsedLimit;
        }

        if (offsetParam) {
            const parsedOffset = parseInt(offsetParam);
            if (isNaN(parsedOffset) || parsedOffset < 0) {
                return NextResponse.json({
                    code: 'VALIDATION_ERROR',
                    message: 'Offset must be an integer greater than or equal to 0'
                }, { status: 400 });
            }
            offset = parsedOffset;
        }

        // Get users
        const users = await User.find()
            .select('-password')
            .limit(limit)
            .skip(offset)
            .lean()
            .exec() as any[];

        const totalUsers = await User.countDocuments();

        return NextResponse.json({
            users,
            pagination: {
                limit,
                offset,
                total: totalUsers,
                hasMore: offset + limit < totalUsers
            }
        });

    } catch (err) {
        logger.error('Error occurred while fetching users:', err);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred while fetching users',
            error: 'Internal Server Error' 
        }, { status: 500 });
    }
}