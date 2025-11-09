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

import { Schema, model, models, Types } from 'mongoose';

export interface IFolder {
    _id?: Types.ObjectId;
    userId: Types.ObjectId;
    title: string;
    description?: string;
    category?: string;
    accessType: 'private' | 'public' | 'password';
    password?: string;
    allowedUsers?: Types.ObjectId[];
    coverImage?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const folderSchema = new Schema<IFolder>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: { type: String },
    category: { type: String },
    accessType: {
        type: String,
        enum: ['private', 'public', 'password'],
        default: 'private'
    },
    password: {
        type: String,
        select: false
    },
    allowedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    coverImage: { type: String }
}, {
    timestamps: true
});

export default models.Folder || model<IFolder>('Folder', folderSchema);