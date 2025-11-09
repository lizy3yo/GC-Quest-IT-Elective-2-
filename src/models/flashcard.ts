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

import mongoose, { Schema, model, models, Types } from 'mongoose';

export interface ICard {
    _id?: Types.ObjectId;
    question: string;
    answer: string;
    image?: string;
}

export interface ISharedUser {
    user?: Types.ObjectId; // Optional for email-only sharing
    email?: string; // Email address for sharing
    role: 'viewer' | 'editor';
    addedAt?: Date;
    status?: 'pending' | 'accepted'; // Status of the invitation
}

export interface IFlashcard {
    user: Types.ObjectId;
    _id?: Types.ObjectId;
    folder?: Types.ObjectId; 
    title: string;
    description?: string;
    cards: ICard[];
    difficulty?: 'easy' | 'medium' | 'hard';
    image?: string;
    tags?: string[];
    subject?: string; // Subject/class name for categorization (e.g., "Integrated Programming and Technologies (LEC)")
    lastReviewed?: Date;
    nextReview?: Date;
    repetitionCount?: number;
    correctCount?: number;
    incorrectCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
    accessType: 'private' | 'public';
    sharingMode?: 'restricted' | 'anyone_with_link'; // How the flashcard can be shared
    password?: string;
    linkRole?: 'viewer' | 'editor'; // Role for anyone with the link
    publicRole?: 'viewer' | 'editor'; // Role for public access (only for public flashcards)
    sharedUsers?: ISharedUser[]; // For restricted sharing with specific users
    shareableLink?: string; // Unique link for sharing
}



const cardSchema = new Schema<ICard>({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    image: { type: String }
});

const sharedUserSchema = new Schema<ISharedUser>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    email: { type: String, required: false },
    role: { type: String, enum: ['viewer', 'editor'], required: true },
    addedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' }
});

const flashcardSchema = new Schema<IFlashcard>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    folder: {
        type: Schema.Types.ObjectId,
        ref: 'Folder',
        required: false
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: { type: String },
    cards: [cardSchema],
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    image: { type: String },
    tags: [{ type: String }],
    subject: { type: String, trim: true }, // Subject/class for categorization
    lastReviewed: { type: Date },
    nextReview: { type: Date },
    repetitionCount: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    accessType: {
        type: String,
        enum: ['private', 'public'],
        default: 'private'
    },
    sharingMode: {
        type: String,
        enum: ['restricted', 'anyone_with_link'],
        required: false // Only needed when sharing is enabled
    },
    password: {
        type: String,
        select: false
    },
    linkRole: {
        type: String,
        enum: ['viewer', 'editor'],
        default: 'viewer'
    },
    publicRole: {
        type: String,
        enum: ['viewer', 'editor'],
        default: 'viewer'
    },
    sharedUsers: [sharedUserSchema],
    shareableLink: {
        type: String,
        unique: true,
        sparse: true // Allows null values but ensures uniqueness when present
    }
}, {
    timestamps: true
});

export default models.Flashcard || model<IFlashcard>('Flashcard', flashcardSchema);
