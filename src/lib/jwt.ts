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

import jwt from 'jsonwebtoken';
import config from './config';
import { Types } from 'mongoose';

export const generateAccessToken = (userId: Types.ObjectId): string => {
   return jwt.sign({ userId }, config.JWT_ACCESS_SECRET,
      {
         expiresIn: config.ACCESS_TOKEN_EXPIRY,
         subject: 'accessApi',
      });
};

export const generateRefreshToken = (userId: Types.ObjectId): string => {
   return jwt.sign({ userId }, config.JWT_REFRESH_SECRET,
      {
         expiresIn: config.REFRESH_TOKEN_EXPIRY,
         subject: 'refreshApi',
      });
};

export const verifyAccessToken = (token: string) => {
   return jwt.verify(token, config.JWT_ACCESS_SECRET);
}

export const verifyRefreshToken = (token: string) => {
   return jwt.verify(token, config.JWT_REFRESH_SECRET);
}

// Alias for backward compatibility
export const verifyToken = verifyAccessToken;