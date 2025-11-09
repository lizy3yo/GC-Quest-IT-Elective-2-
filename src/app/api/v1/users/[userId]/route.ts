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
import { validateMongoId } from '@/lib/middleware/validation';

//Models
import User from '@/models/user';

interface RouteParams {
    params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        await connectToDatabase();
        
        // Authenticate user
        const authResult = await authenticate(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { userId: currentUserId } = authResult;

        // Authorize user (admin only)
        const authzResult = await authorize(currentUserId, ['admin']);
        if (authzResult instanceof Response) {
            return authzResult as Response;
        }

        const { userId } = await params;

        // Validate userId
        const userIdError = validateMongoId(userId, 'userId');
        if (userIdError) {
            return NextResponse.json({ 
                code: 'VALIDATION_ERROR',
                message: userIdError.message 
            }, { status: 400 });
        }

        // Get user by ID
        const user = await User.findById(userId)
            .select('-password')
            .lean()
            .exec() as any;

        if (!user) {
            return NextResponse.json({
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            }, { status: 404 });
        }

        return NextResponse.json({ user });

    } catch (err) {
        logger.error('Error occurred while fetching user by ID:', err);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred while fetching user',
            error: 'Internal Server Error' 
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        await connectToDatabase();
        
        // Authenticate user
        const authResult = await authenticate(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { userId: currentUserId } = authResult;

        // Authorize user (admin only)
        const authzResult = await authorize(currentUserId, ['admin']);
        if (authzResult instanceof Response) {
            return authzResult as Response;
        }

        const { userId } = await params;

        // Validate userId
        const userIdError = validateMongoId(userId, 'userId');
        if (userIdError) {
            return NextResponse.json({ 
                code: 'VALIDATION_ERROR',
                message: userIdError.message 
            }, { status: 400 });
        }

        // Delete user by ID
        const deletedUser = await User.findByIdAndDelete(userId) as any;

        if (!deletedUser) {
            return NextResponse.json({
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            }, { status: 404 });
        }

        return NextResponse.json({ 
            message: 'User deleted successfully' 
        });

    } catch (err) {
        logger.error('Error occurred while deleting user by ID:', err);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred while deleting user',
            error: 'Internal Server Error' 
        }, { status: 500 });
    }
}