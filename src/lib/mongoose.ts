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

//CLIENT OPTION
const clientOptions: ConnectOptions = {
  dbName: 'gc-quest-db',
  appName: 'GC-Quest',
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  },
};

let isConnected = false;

/**
 * Establishes a connection to the MongoDB database using Mongoose.
 * If an error occurs during the connection process, it throws an error
 * with a descriptive message.
 *
 * - Uses `MONGO_URI` as the connection string.
 * - `clientOptions` contains additional configuration for Mongoose.
 * - Errors are properly handled and rethrown for better debugging.
 */
const connectToDatabase = async (): Promise<void> => {
    if (isConnected) {
        return;
    }

    if (!config.MONGO_URI) {
        throw new Error('MONGO_URI is not defined in the environment variables');
    } 
    
    try {
        await mongoose.connect(config.MONGO_URI, clientOptions);
        isConnected = true;
        
        console.log('Connected to Database successfully', {
            uri: config.MONGO_URI,
            options: clientOptions,
        });
    } catch (err) {
        console.error('Failed to connect to the database:', err);
        if (err instanceof Error) {
            throw err;
        }
        throw new Error('Database connection failed');
    }
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