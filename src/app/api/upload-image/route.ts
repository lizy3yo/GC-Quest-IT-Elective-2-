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

import { NextRequest, NextResponse } from 'next/server';
import { UploadImage } from '../../lib/upload';
import { connectToDatabase } from '@/lib/mongoose';

export async function POST(request: NextRequest) {
    await connectToDatabase();

    const formData = await request.formData();

    try{
        const image = formData.get('image') as File;

        if(image){
            //upload to cloudinary
            const uploadResult = await UploadImage(image, 'image-upload');
            console.log("Image uploaded:", uploadResult);
        }
    } catch(error){
    
    }
    
}
    
