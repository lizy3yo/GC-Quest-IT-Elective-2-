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

//Custom Modules
import config from '@/lib/config';
import { logger } from '@/lib/winston';
import { connectToDatabase } from '@/lib/mongoose';
import { authenticate } from '@/lib/middleware/authenticate';

//Models
import Token from '@/models/token';

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        
        // Authenticate user
        const authResult = await authenticate(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { userId } = authResult;
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get('refreshToken')?.value;

        if (refreshToken) {
            await Token.deleteOne({ token: refreshToken });

            logger.info('User refresh token deleted successfully', {
                userId: userId,
                token: refreshToken
            });
        }

        // Clear both refresh token and access token cookies
        cookieStore.set('refreshToken', '', {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            expires: new Date(0)
        });

        cookieStore.set('accessToken', '', {
            httpOnly: true,
            secure: config.NODE_ENV === 'production',
            sameSite: 'strict',
            expires: new Date(0)
        });

        logger.info('User logged out successfully', {
            userId: userId
        });

        return new NextResponse(null, { status: 204 });

    } catch (err) {
        logger.error('Error occurred during logout:', err);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred during logout',
            error: 'Internal Server Error' 
        }, { status: 500 });
    }
}