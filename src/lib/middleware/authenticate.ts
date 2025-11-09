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
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

//Custom Modules
import {verifyAccessToken} from '@/lib/jwt';

//Types
import type {Types} from 'mongoose';

/**
 * @function authenticate
 * @description Middleware to verify the user's access token from the Authorization header.
 *              If the token is valid, the user's ID is attached to the request object.
 *              Otherwise, it returns an appropriate error response.
 *
 * @param {Request} request - Next.js request object. Expects a Bearer token in the Authorization header.
 *
 * @returns {Promise<{userId: Types.ObjectId} | Response>}
 */

export const authenticate = async (request: Request): Promise<{userId: Types.ObjectId} | Response> => {
    const authHeader = request.headers.get('authorization');

    //If there's no Bearer token, respond with 401 Unauthorized
    if (!authHeader?.startsWith('Bearer')){
        return new Response(JSON.stringify({
            code: 'AuthenticationError',
            message: 'No valid token provided'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    //Split out the token from the 'Bearer' prefix
    const [_, token] = authHeader.split(' ');

    try{
        //Verify the token and extract the userId from the payload
        const jwtPayload = verifyAccessToken(token) as {userId: Types.ObjectId};

        //Return the userId
        return { userId: jwtPayload.userId };

    }catch (err) {
        //Handle expired token error
        if (err instanceof TokenExpiredError) {
            return new Response(JSON.stringify({
                code: 'TokenExpiredError',
                message: 'Token has expired, request a new one with a refresh token'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (err instanceof JsonWebTokenError) {
            return new Response(JSON.stringify({
                code: 'JsonWebTokenError',
                message: 'Error parsing token'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        //Catch all other errors
        console.error('Error occurred during authentication:', err);
        return new Response(JSON.stringify({
            code: 'ServerError',
            message: 'Internal Server Error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export default authenticate;