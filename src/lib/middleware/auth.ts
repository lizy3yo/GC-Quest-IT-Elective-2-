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

import { NextRequest } from 'next/server';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { verifyAccessToken } from '../jwt';
import { logger } from '../winston';
import { Types } from 'mongoose';

export interface AuthenticatedRequest extends NextRequest {
  userId?: Types.ObjectId;
}

export const authenticate = (req: NextRequest): { success: boolean; userId?: Types.ObjectId; error?: any } => {
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      success: false,
      error: {
        status: 401,
        code: 'AuthenticationError',
        message: 'No valid token provided'
      }
    };
  }

  const token = authHeader.split(' ')[1];

  try {
    const jwtPayload = verifyAccessToken(token) as { userId: Types.ObjectId };
    return {
      success: true,
      userId: jwtPayload.userId
    };
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return {
        success: false,
        error: {
          status: 401,
          code: 'TokenExpiredError',
          message: 'Token has expired, request a new one with a refresh token'
        }
      };
    }
    
    if (err instanceof JsonWebTokenError) {
      return {
        success: false,
        error: {
          status: 401,
          code: 'JsonWebTokenError',
          message: 'Error parsing token'
        }
      };
    }

    logger.error('Error occurred during authentication:', err);
    return {
      success: false,
      error: {
        status: 500,
        code: 'ServerError',
        message: 'Internal Server Error'
      }
    };
  }
};