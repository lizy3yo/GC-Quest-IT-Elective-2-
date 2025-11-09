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
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

//Custom Modules
import { verifyRefreshToken, generateAccessToken } from "@/lib/jwt";
import { logger } from '@/lib/winston';
import { connectToDatabase } from '@/lib/mongoose';

//Models
import Token from '@/models/token';

//Types
import { Types } from 'mongoose';

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get('refreshToken')?.value;

        if (!refreshToken) {
            return NextResponse.json({
                code: 'VALIDATION_ERROR',
                message: 'Refresh token is required'
            }, { status: 400 });
        }

        // Check if token exists in database
        const tokenExists = await Token.exists({ token: refreshToken });

        if (!tokenExists) {
            return NextResponse.json({
                code: 'Unauthorized',
                message: 'Invalid or expired refresh token',
            }, { status: 401 });
        }

        // Verify Refresh Token
        const jwtPayload = verifyRefreshToken(refreshToken) as { userId: Types.ObjectId };

        const accessToken = generateAccessToken(jwtPayload.userId);

        return NextResponse.json({
            code: 'Success',
            message: 'Access token generated successfully',
            data: {
                accessToken
            }
        });

    } catch (err) {
        if (err instanceof TokenExpiredError) {
            return NextResponse.json({
                code: 'Unauthorized',
                message: 'Refresh token expired, please login again'
            }, { status: 401 });
        }

        if (err instanceof JsonWebTokenError) {
            return NextResponse.json({
                code: 'Unauthorized',
                message: 'Invalid refresh token'
            }, { status: 401 });
        }

        logger.error('Error during refresh token', err);
        return NextResponse.json({
            code: 'Server Error',
            message: 'Internal Server Error'
        }, { status: 500 });
    }
}