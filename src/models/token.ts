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

//Node Modules
import {Schema, model, models, Types} from 'mongoose';

interface IToken{
    token: string;
    userId: Types.ObjectId;
}

const tokenSchema = new Schema<IToken>({
    token:{
        type: String,
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
    },
});

// Use models to prevent re-compilation in Next.js
export default models.Token || model<IToken>('Token', tokenSchema);