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

export const runtime = 'nodejs';

//Custom Modules
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt';
import { logger } from '@/lib/winston';
import config from '@/lib/config';
import { connectToDatabase } from '@/lib/mongoose';
import { validateEmail, validatePassword } from '@/lib/middleware/validation';

//Models
import User from '@/models/user';
import Token from '@/models/token';

//Types
import type { IUser } from '@/models/user';
import type { Types } from 'mongoose';

type UserData = Pick<IUser, 'email' | 'password'> & { role?: 'student' | 'instructor' };

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json() as UserData;
  const { email, password, role: requestedRole } = body;

    // Validation
    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        message: emailError.message
      }, { status: 400 });
    }

    // Ensure password is a string before passing to validators
    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        message: 'Password is required'
      }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        message: passwordError.message
      }, { status: 400 });
    }

    // Find user
    const user = await User.findOne({ email })
      .select('username email password role firstName lastName emailVerified')
      .lean()
      .exec() as {
        _id: Types.ObjectId;
        username: string;
        email: string;
        password: string;
        role: string;
        firstName: string;
        lastName: string;
        emailVerified?: boolean;
      } | null;

    if (!user) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        message: 'Email or password is invalid',
      }, { status: 400 });
    }

    // Verify role matches if provided
    if (requestedRole) {
      // Normalize: frontend sends "instructor" but DB stores "teacher"
      const normalizedRole = requestedRole === 'instructor' ? 'teacher' : requestedRole;
      if (user.role !== normalizedRole) {
        return NextResponse.json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid credentials for the selected role',
        }, { status: 400 });
      }
    }

    // Verify password
    // Ensure user.password exists before comparing
    if (!user.password) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        message: 'Email or password is invalid',
      }, { status: 400 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        message: 'Email or password is invalid',
      }, { status: 400 });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in database
    await Token.create({
      token: refreshToken,
      userId: user._id
    });

    logger.info('Refresh token stored in database for user', {
      userId: user._id,
      token: refreshToken,
    });

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    const response = NextResponse.json({
      Student: {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified || false
      },
      accessToken,
    });

    logger.info('User logged in successfully:', {
      userId: user._id,
      email: user.email,
      username: user.username
    });

    return response;

  } catch (err) {
    logger.error('Error occurred during login:', err);
    return NextResponse.json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred during login',
      error: 'Internal Server Error'
    }, { status: 500 });
  }
}