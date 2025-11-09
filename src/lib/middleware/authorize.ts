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

//Models
import User from '@/models/user';

//Types
import type {Types} from 'mongoose';

/**
 * @function authorize
 * @description Middleware to check if the authenticated user has the required role(s).
 *
 * @param {Types.ObjectId} userId - The authenticated user's ID
 * @param {string[]} allowedRoles - Array of roles that are allowed to access the resource
 *
 * @returns {Promise<boolean | Response>}
 */

export const authorize = async (userId: Types.ObjectId, allowedRoles: string[]): Promise<boolean | Response> => {
    try {
        const user = await User.findById(userId).select('role').lean().exec() as { role: string } | null;

        if (!user) {
            return new Response(JSON.stringify({
                code: 'UserNotFound',
                message: 'User not found'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!allowedRoles.includes(user.role)) {
            return new Response(JSON.stringify({
                code: 'Forbidden',
                message: 'You do not have permission to access this resource'
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return true;

    } catch (err) {
        console.error('Error occurred during authorization:', err);
        return new Response(JSON.stringify({
            code: 'ServerError',
            message: 'Internal Server Error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export default authorize;