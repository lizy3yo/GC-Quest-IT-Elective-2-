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
import mongoose from "mongoose";

//CUSTOM MODULES
import config from "@/lib/config";

//TYPES
import type {ConnectOptions} from 'mongoose';

//CLIENT OPTION - Optimized for Vercel serverless with connection pooling
const clientOptions: ConnectOptions = {
  dbName: 'gc-quest-db',
  appName: 'GC-Quest',
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  },
  // Connection pooling settings optimized for serverless
  maxPoolSize: 10, // Maximum number of connections in the pool
  minPoolSize: 2, // Minimum number of connections to maintain
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
  // Retry settings
  retryWrites: true,
  retryReads: true,
};

let isConnected = false;
let connectionPromise: Promise<void> | null = null;

/**
 * Establishes a connection to the MongoDB database using Mongoose.
 * Optimized for Vercel serverless with connection reuse and pooling.
 * 
 * - Uses `MONGO_URI` as the connection string.
 * - `clientOptions` contains additional configuration for Mongoose.
 * - Implements connection caching to prevent multiple connections in serverless
 * - Errors are properly handled and rethrown for better debugging.
 */
const connectToDatabase = async (): Promise<void> => {
    // Return existing connection if already connected
    if (isConnected && mongoose.connection.readyState === 1) {
        return;
    }

    // Return existing connection promise if connection is in progress
    if (connectionPromise) {
        return connectionPromise;
    }

    if (!config.MONGO_URI) {
        throw new Error('MONGO_URI is not defined in the environment variables');
    } 
    
    // Create connection promise to prevent multiple simultaneous connections
    connectionPromise = (async () => {
        try {
            // Check if mongoose already has a connection
            if (mongoose.connection.readyState === 1) {
                isConnected = true;
                return;
            }

            // Disconnect if in a bad state
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }

            await mongoose.connect(config.MONGO_URI!, clientOptions);
            isConnected = true;
            
            console.log('✅ Connected to Database successfully', {
                poolSize: clientOptions.maxPoolSize,
                readyState: mongoose.connection.readyState,
            });

            // Set up connection event handlers
            mongoose.connection.on('disconnected', () => {
                console.log('⚠️ MongoDB disconnected');
                isConnected = false;
                connectionPromise = null;
            });

            mongoose.connection.on('error', (err) => {
                console.error('❌ MongoDB connection error:', err);
                isConnected = false;
                connectionPromise = null;
            });

        } catch (err) {
            console.error('❌ Failed to connect to the database:', err);
            isConnected = false;
            connectionPromise = null;
            if (err instanceof Error) {
                throw err;
            }
            throw new Error('Database connection failed');
        }
    })();

    return connectionPromise;
}

/**
 * Disconnects from the MongoDB database using Mongoose.
 *
 * This function attempts to disconnect from the database asynchronously.
 * If the disconnection is successful, a success message is logged.
 * If an error occurs, it is either re-thrown as a new Error (if it's an instance of Error)
 * or logged to the console.
 */
const disconnectFromDatabase = async (): Promise<void> => {
    if (!isConnected) {
        return;
    }

    try {
        await mongoose.disconnect();
        isConnected = false;
        console.log('Disconnected from Database successfully', {
            uri: config.MONGO_URI,
            options: clientOptions,
        });
    } catch (err) {
        console.error('Failed to disconnect from the database:', err);
        if (err instanceof Error) {
            throw new Error(err.message);
        }
        throw new Error('Database disconnection failed');
    }
}
export { connectToDatabase, disconnectFromDatabase };
export default mongoose;