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

//NODE MODULES
import {Schema, model, models} from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser{
    username: string;
    email: string;
    password?: string; // made optional
    role: 'student' | 'teacher' | 'admin' | 'coordinator' | 'parent';
    honorifics?: string; // optional (e.g. 'Ms.', 'Mr.', 'Dr.')
    firstName: string;
    lastName: string;
    profileImage?: string; // URL to profile picture
    studentNumber?: string; // for students (e.g., 202511564)
    linkedStudentId?: string; // for parents - links to their child's student account
    socialLinks?: {
        website?: string;
        facebook?: string;
        instagram?: string;
    };
    emailVerified?: boolean;
    verificationCode?: string;
    verificationCodeExpiry?: Date;
    resetPasswordCode?: string;
    resetPasswordExpiry?: Date;
    archived?: boolean;
    archivedAt?: Date;
}

// User schema
const userSchema = new Schema<IUser>({
    username: { 
        type: String, 
        required: [true, 'Username is required'],
        maxLength: [20, 'Username must be at most 20 characters long'],
        unique: [true, 'Username must be unique']
    },
    email: { 
        type: String, 
        required: [true, 'Email is required'],
        maxLength: [50, 'Email must be at most 50 characters long'],
        unique: [true, 'Email must be unique']
    },
    password: { 
        type: String, 
        // no longer required for OAuth users
    },
    role: { 
        type: String, 
        required: [true, 'Role is required'],
        enum:{
            values: ['student', 'teacher', 'admin', 'coordinator', 'parent'],
            message: '{VALUE} is not a valid role'
        }, 
        default: 'student',
    },
    studentNumber: {
        type: String,
        maxLength: [20, 'Student number must be less than 20 characters long']
    },
    linkedStudentId: {
        type: String
    },
    firstName: { 
        type: String, 
        maxLength: [20, 'First name must be less than 20 characters long'],
        required: [true, 'First name is required'],
    },
    honorifics: {
        type: String,
        maxLength: [10, 'Honorifics must be less than 10 characters long']
    },
    lastName: { 
        type: String, 
        maxLength: [20, 'Last name must be less than 20 characters long'],
        required: [true, 'Last name is required'],
    },
    profileImage: {
        type: String,
        maxLength: [500, 'Profile image URL must be less than 500 characters long']
    },
    socialLinks: {
        website: { 
            type: String, 
            maxLength: [100, 'Website URL must be less than 100 characters long'] 
        },
        facebook: { 
            type: String, 
            maxLength: [100, 'Facebook URL must be less than 100 characters long'] 
        },
        instagram: { 
            type: String, 
            maxLength: [100, 'Instagram URL must be less than 100 characters long'] 
        },
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    verificationCode: {
        type: String
    },
    verificationCodeExpiry: {
        type: Date
    },
    resetPasswordCode: {
        type: String
    },
    resetPasswordExpiry: {
        type: Date
    },
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for query optimization
// Note: email and username already have indexes from unique: true
userSchema.index({ role: 1 }); // For filtering by role
userSchema.index({ studentNumber: 1 }); // For student lookups
userSchema.index({ linkedStudentId: 1 }); // For parent-student relationships
userSchema.index({ archived: 1, role: 1 }); // Compound index for active user queries
userSchema.index({ emailVerified: 1 }); // For filtering verified users
userSchema.index({ createdAt: -1 }); // For sorting by registration date

userSchema.pre('save', async function(next) {
    // If no password present or password not modified, skip hashing
    if (!this.password || !this.isModified('password')) {
        next();
        return;
    }
    // password hashing
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Use models to prevent re-compilation in Next.js
// Force model refresh if role enum doesn't include 'parent'
try {
    if (models && (models as any).User) {
        const existing = (models as any).User;
        const roleEnum = existing.schema?.path('role')?.enumValues;
        if (!roleEnum || !roleEnum.includes('parent')) {
            // remove the stale model so it can be recreated with the new schema
            delete (models as any).User;
        }
    }
} catch (e) {
    // ignore and continue to create model
}

export default (models.User as any) || model<IUser>('User', userSchema);