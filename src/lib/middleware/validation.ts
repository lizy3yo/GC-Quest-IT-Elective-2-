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

import type { NextRequest, NextResponse } from 'next/server';

/**
 * Validate email format and requirements
 */
export const validateEmail = (email: string): { message: string } | null => {
  if (!email) {
    return { message: 'Email is required' };
  }
  
  if (email.length > 50) {
    return { message: 'Email must not exceed 50 characters' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { message: 'Email must be a valid email address' };
  }
  
  return null;
};

/**
 * Validate password format and requirements
 */
export const validatePassword = (password: string): { message: string } | null => {
  if (!password) {
    return { message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { message: 'Password must be at least 8 characters long' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/\d/.test(password)) {
    return { message: 'Password must contain at least one number' };
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    return { message: 'Password must contain at least one symbol (@$!%*?&)' };
  }
  
  return null;
};

/**
 * Validate username format and requirements
 */
export const validateUsername = (username: string): { message: string } | null => {
  if (!username) {
    return { message: 'Username is required' };
  }
  
  if (username.length < 2 || username.length > 100) {
    return { message: 'Username must be between 2 and 100 characters long' };
  }
  
  return null;
};

/**
 * Validate name format and requirements
 */
export const validateName = (name: string, fieldName: string): { message: string } | null => {
  if (!name) {
    return { message: `${fieldName} is required` };
  }
  
  if (name.length < 2 || name.length > 20) {
    return { message: `${fieldName} must be between 2 and 20 characters long` };
  }
  
  return null;
};

/**
 * Validate MongoDB ObjectId format
 */
export const validateMongoId = (id: string, fieldName: string): { message: string } | null => {
  if (!id) {
    return { message: `${fieldName} is required` };
  }
  
  const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!mongoIdRegex.test(id)) {
    return { message: `Invalid ${fieldName}` };
  }
  
  return null;
};