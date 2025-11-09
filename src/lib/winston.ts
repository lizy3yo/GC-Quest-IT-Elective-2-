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

import config from '@/lib/config';
import { writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  stack?: string;
  meta?: any;
}

class Logger {
  private logLevel: LogLevel;
  private service: string;
  private logDir: string;

  constructor() {
    this.logLevel = (config.LOG_LEVEL as LogLevel) || 'info';
    this.service = 'gc-quest-api';
    this.logDir = process.cwd();
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    return levels[level] <= levels[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service
    };

    if (meta) {
      if (meta instanceof Error) {
        entry.stack = meta.stack;
        entry.message = `${message}: ${meta.message}`;
      } else {
        entry.meta = meta;
      }
    }

    return entry;
  }

  private writeToFile(filename: string, entry: LogEntry) {
    if (typeof window !== 'undefined') return; // Skip file writing in browser
    
    try {
      const filePath = join(this.logDir, filename);
      const logLine = JSON.stringify(entry) + '\n';
      
      if (existsSync(filePath)) {
        appendFileSync(filePath, logLine);
      } else {
        writeFileSync(filePath, logLine);
      }
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, message: string, meta?: any) {
    if (!this.shouldLog(level)) return;

    const entry = this.formatMessage(level, message, meta);

    // Always log to console in development
    if (config.NODE_ENV !== 'production') {
      const consoleMethod = level === 'error' ? 'error' : 
                           level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[${entry.timestamp}] ${level.toUpperCase()}: ${entry.message}`);
      if (entry.stack) console.error(entry.stack);
      if (entry.meta) console.log('Meta:', entry.meta);
    }

    // Write to files
    this.writeToFile('combined.log', entry);
    if (level === 'error') {
      this.writeToFile('error.log', entry);
    }
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }
}

export const logger = new Logger();