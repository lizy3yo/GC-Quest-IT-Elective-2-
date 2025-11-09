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
import { validateUsername, validateEmail, validatePassword, validateName } from '@/lib/middleware/validation';

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

        // Authorize user
        const authzResult = await authorize(userId, ['student', 'teacher', 'admin']);
        if (authzResult instanceof Response) {
            return authzResult as Response;
        }

        // Get current user
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
        logger.error('Error occurred while fetching current user:', err);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred while fetching current user',
            error: 'Internal Server Error' 
        }, { status: 500 });
    }
}

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
        const authzResult = await authorize(userId, ['student', 'teacher', 'admin']);
        if (authzResult instanceof Response) {
            return authzResult as Response;
        }

        const body = await request.json();
        const { username, email, password, firstName, lastName } = body;

        // Validation
        if (username) {
            const usernameError = validateUsername(username);
            if (usernameError) {
                return NextResponse.json({ 
                    code: 'VALIDATION_ERROR',
                    message: usernameError.message 
                }, { status: 400 });
            }

            // Check if username is already taken
            const userExists = await User.exists({ username, _id: { $ne: userId } });
            if (userExists) {
                return NextResponse.json({ 
                    code: 'VALIDATION_ERROR',
                    message: 'Username is already taken' 
                }, { status: 400 });
            }
        }

        if (email) {
            const emailError = validateEmail(email);
            if (emailError) {
                return NextResponse.json({ 
                    code: 'VALIDATION_ERROR',
                    message: emailError.message 
                }, { status: 400 });
            }

            // Check if email is already taken
            const userExists = await User.exists({ email, _id: { $ne: userId } });
            if (userExists) {
                return NextResponse.json({ 
                    code: 'VALIDATION_ERROR',
                    message: 'Email is already taken' 
                }, { status: 400 });
            }
        }

        if (password) {
            const passwordError = validatePassword(password);
            if (passwordError) {
                return NextResponse.json({ 
                    code: 'VALIDATION_ERROR',
                    message: passwordError.message 
                }, { status: 400 });
            }
        }

        if (firstName) {
            const firstNameError = validateName(firstName, 'firstName');
            if (firstNameError) {
                return NextResponse.json({ 
                    code: 'VALIDATION_ERROR',
                    message: firstNameError.message 
                }, { status: 400 });
            }
        }

        if (lastName) {
            const lastNameError = validateName(lastName, 'lastName');
            if (lastNameError) {
                return NextResponse.json({ 
                    code: 'VALIDATION_ERROR',
                    message: lastNameError.message 
                }, { status: 400 });
            }
        }

        // Prepare update data
        const updateData: any = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password').lean().exec() as any;

        if (!updatedUser) {
            return NextResponse.json({
                code: 'USER_NOT_FOUND',
                message: 'User not found'
            }, { status: 404 });
        }

        return NextResponse.json({ 
            message: 'User updated successfully',
            user: updatedUser 
        });

    } catch (err) {
        logger.error('Error occurred while updating current user:', err);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred while updating current user',
            error: 'Internal Server Error' 
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        await connectToDatabase();
        
        // Authenticate user
        const authResult = await authenticate(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const { userId } = authResult;

        // Authorize user
        const authzResult = await authorize(userId, ['student', 'teacher', 'admin']);
        if (authzResult instanceof Response) {
            return authzResult as Response;
        }

        // Delete user
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
        logger.error('Error occurred while deleting current user:', err);
        return NextResponse.json({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred while deleting current user',
            error: 'Internal Server Error' 
        }, { status: 500 });
    }
}