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

export const runtime = 'nodejs';

import { connectToDatabase } from '@/lib/mongoose';
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt';
import { logger } from '@/lib/winston';
import config from '@/lib/config';
import { genUsername } from '@/lib/utils';
import User from '@/models/user';
import Token from '@/models/token';
import type { IUser } from '@/models/user';

type UserData = Pick<IUser, 'username' | 'firstName' | 'lastName' | 'email' | 'password' | 'role'>;
// Include honorifics in accepted UserData
type UserDataWithHonorifics = UserData & { honorifics?: string };

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
  const body = await request.json() as UserDataWithHonorifics;
  const { firstName, lastName, email, password, role, honorifics } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields'
      }, { status: 400 });
    }

    // Check if admin registration is allowed
    if (role === 'admin' && !config.WHITELIST_ADMINS_MAIL.includes(email)) {
      logger.warn(`User with email ${email} attempted to register as an admin but is not whitelisted.`);
      return NextResponse.json({
        code: 'FORBIDDEN',
        message: 'You are not allowed to register as an admin',
      }, { status: 403 });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({
        code: 'USER_EXISTS',
        message: 'Email is already registered'
      }, { status: 409 });
    }

    // Generate username and create user
    const username = genUsername();
    const newUser = await User.create({
      email,
      password,
      role: role || 'student',
      username,
      honorifics,
      firstName,
      lastName
    });

    // Debugging: log incoming honorifics and what's saved on the created user
    logger.debug('Register: incoming body honorifics', { honorifics });
    logger.debug('Register: created user honorifics', { honorifics: newUser.honorifics });

    // Generate tokens
    const accessToken = generateAccessToken(newUser._id);
    const refreshToken = generateRefreshToken(newUser._id);

    // Store refresh token in database
    await Token.create({
      token: refreshToken,
      userId: newUser._id
    });

    logger.info('User registered successfully:', {
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    });

    // Create response with cookies
    const response = NextResponse.json({
      Student: {
        username: newUser.username,
        honorifics: newUser.honorifics,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      },
      accessToken,
    }, { status: 201 });

    // Set cookies
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return response;

  } catch (err) {
    logger.error('Error occurred during registration:', err);
    return NextResponse.json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred during registration',
      error: 'Internal Server Error'
    }, { status: 500 });
  }
}