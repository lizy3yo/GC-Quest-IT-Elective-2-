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
import bcrypt from 'bcrypt';

//Custom Modules
import { connectToDatabase } from '@/lib/mongoose';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';
import { logger } from '@/lib/winston';
import { validatePassword } from '@/lib/middleware/validation';

//Models
import User from '@/models/user';

export async function PUT(request: NextRequest) {
    try {
        await connectToDatabase();
        
        // Authenticate user
        const authResult = await authenticate(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { userId } = authResult;

        // Authorize user
        const authzResult = await authorize(userId, ['student', 'teacher', 'admin', 'coordinator', 'parent']);
        if (authzResult instanceof Response) {
            return authzResult as Response;
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Current password and new password are required'
            }, { status: 400 });
        }

        // Validate new password
        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return NextResponse.json({ 
                code: 'VALIDATION_ERROR',
                message: passwordError.message 
            }, { status: 400 });
        }

        // Get user with password
        const user = await User.findById(userId).select('+password').exec();

        if (!user) {
            return NextResponse.json({
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            }, { status: 404 });
        }

        // Check if user has a password (OAuth users might not have one)
        if (!user.password) {
            return NextResponse.json({
                code: 'NO_PASSWORD',
                message: 'This account uses OAuth authentication and does not have a password. Please use your OAuth provider to manage your account.'
            }, { status: 400 });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return NextResponse.json({
                code: 'INVALID_PASSWORD',
                message: 'Current password is incorrect'
            }, { status: 401 });
        }

        // Update password directly in database to avoid double hashing
        // The User model has a pre-save hook that hashes passwords, so we need to bypass it
        await User.findByIdAndUpdate(
            userId,
            { password: await bcrypt.hash(newPassword, 10) },
            { new: true }
        );

        logger.info(`Password changed successfully for user ${userId}`);

        return NextResponse.json({ 
            message: 'Password changed successfully'
        });

    } catch (err) {
        logger.error('Error occurred while changing password:', err);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred while changing password',
            error: 'Internal Server Error' 
        }, { status: 500 });
    }
}
