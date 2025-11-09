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

export interface ValidationError {
  field: string;
  message: string;
}

export const validateEmail = (email: string): ValidationError | null => {
  if (!email) return { field: 'email', message: 'Email is required' };
  if (email.length > 50) return { field: 'email', message: 'Email must not exceed 50 characters' };
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return { field: 'email', message: 'Email must be a valid email address' };
  
  return null;
};

export const validatePassword = (password: string): ValidationError | null => {
  if (!password) return { field: 'password', message: 'Password is required' };
  if (password.length < 8) return { field: 'password', message: 'Password must be at least 8 characters long' };
  
  if (!/[a-z]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one uppercase letter' };
  }
  if (!/\d/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one number' };
  }
  if (!/[@$!%*?&]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one symbol (@$!%*?&)' };
  }
  
  return null;
};

export const validateRole = (role: string): ValidationError | null => {
  if (!['student', 'teacher', 'admin'].includes(role)) {
    return { field: 'role', message: 'Role must be either "student", "teacher", or "admin"' };
  }
  return null;
};

export const validateName = (name: string, fieldName: string): ValidationError | null => {
  if (!name) return { field: fieldName, message: `${fieldName} is required` };
  if (name.length < 2) return { field: fieldName, message: `${fieldName} must be at least 2 characters long` };
  if (name.length > 20) return { field: fieldName, message: `${fieldName} must not exceed 20 characters` };
  return null;
};