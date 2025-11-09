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

import { Schema, model, models, Types, Document, Model } from 'mongoose';

// TypeScript interfaces for the StudyProgress document
export interface IStudyProgressLearnPref {
  trackProgress: boolean;
  showOptions: boolean;
  shuffle: boolean;
  studyStarredOnly: boolean;
  soundEffects: boolean;
  textToSpeech: boolean;
  allowMultipleChoice: boolean;
  allowWritten: boolean;
}

export interface IStudyProgressLearn {
  masteredIds: string[];
  incorrectIds: string[];
  currentIndex: number;
  hintLevel: number;
  hint: string | null;
  // cardOptions is a map from cardId -> array of wrong option strings
  cardOptions: Map<string, string[]>;
  pref: IStudyProgressLearnPref;
}

export interface IStudyProgressFlashcardPrefs {
  trackProgress: boolean;
  shuffle: boolean;
  studyStarredOnly: boolean;
  sidePreference: 'term' | 'definition';
  showBothSides: boolean;
}

export interface IStudyProgressFlashcards {
  starredIds: string[];
  prefs: IStudyProgressFlashcardPrefs;
}

export interface IStudyProgressMatch {
  shuffledAnswers: Array<{ id: string; text: string }>;
  matches: Map<string, string>;
  mode?: 'immediate' | 'end';
}

export interface IStudyProgressTest {
  questionsOrder: number[];
  questionTypes: ('multiple-choice' | 'written')[];
  selectedAnswers: string[];
  writtenAnswers: string[];
  // Saved choice arrays for each question (e.g. [['A','B','C'], ['foo','bar']])
  questionChoices?: string[][];
  shuffleChoices: boolean;
  feedbackMode: 'immediate' | 'end';
  score: number;
  done: boolean;
  testMode: 'multiple-choice' | 'written' | 'mixed'; // Added testMode
  // Per-question allowed modes (e.g. ['multiple-choice'] or ['written'] or ['multiple-choice','written'])
  questionAllowedModes?: ('multiple-choice' | 'written')[];
}

export interface IStudyProgress extends Document {
  user: Types.ObjectId;
  flashcard: Types.ObjectId;
  flashcards: IStudyProgressFlashcards;
  learn: IStudyProgressLearn;
  match: IStudyProgressMatch;
  test: IStudyProgressTest;
  sessionQueue: number[];
  viewerPos: number;
  lastSessionStartedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const StudyProgressSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  flashcard: { type: Types.ObjectId, ref: 'Flashcard', required: true, index: true },

  // namespaced flashcard fields (preferred)
  flashcards: {
    starredIds: { type: [String], default: [] },
    prefs: {
      trackProgress: { type: Boolean, default: true },
      shuffle: { type: Boolean, default: false },
      studyStarredOnly: { type: Boolean, default: false },
      sidePreference: { type: String, enum: ['term', 'definition'], default: 'term' },
      showBothSides: { type: Boolean, default: false }
    }
  },

  // learn mode
  learn: {
    // Progress tracking fields
    masteredIds: { type: [String], default: [] },
    incorrectIds: { type: [String], default: [] },
    currentIndex: { type: Number, default: 0 },
    hintLevel: { type: Number, default: 0 },
    hint: { type: String, default: null },

    // Persist per-card wrong options as a Map where each value is an array of strings
    // (ensures the front-end can restore wrong options reliably and avoid re-calling AI)
    cardOptions: { type: Map, of: [String], default: {} },
    
    pref: {
      trackProgress: { type: Boolean, default: true },
      showOptions: { type: Boolean, default: false },
      shuffle: { type: Boolean, default: false },
      studyStarredOnly: { type: Boolean, default: false },
      soundEffects: { type: Boolean, default: false },
      textToSpeech: { type: Boolean, default: false },
      allowMultipleChoice: { type: Boolean, default: true },
      allowWritten: { type: Boolean, default: true }
    }
  },

  // match mode
  match: {
    shuffledAnswers: { type: [{ id: String, text: String }], default: [] },
    matches: { type: Map, of: String, default: {} },
    mode: { type: String, enum: ['immediate', 'end'], default: 'immediate' }
  },

  // test mode
  test: {
    questionsOrder: { type: [Number], default: [] },
    // Per-question type for mixed mode ('multiple-choice' | 'written')
    questionTypes: { type: [String], default: [] },
    // Answers selected for multiple-choice questions (index-aligned)
    selectedAnswers: { type: [String], default: [] },
    // Written answers (index-aligned) for written questions
    writtenAnswers: { type: [String], default: [] },
    // Exact choices shown for each question (index-aligned)
    questionChoices: { type: [[String]], default: [] },
    // Per-question allowed modes: array aligned with questions; empty => no restriction
    questionAllowedModes: { type: [String], default: [] },
    // Session-level options
    shuffleChoices: { type: Boolean, default: true },
    feedbackMode: { type: String, enum: ['immediate', 'end'], default: 'end' },
    score: { type: Number, default: 0 },
    done: { type: Boolean, default: false },
    testMode: { type: String, enum: ['multiple-choice', 'written', 'mixed'], default: 'multiple-choice' }, // Added testMode
  },
  
  // viewer/session
  sessionQueue: { type: [Number], default: [] },
  viewerPos: { type: Number, default: 0 },

  // optional metadata about sessions
  lastSessionStartedAt: { type: Date, default: null }
}, { timestamps: true });

// Static helper to merge incoming cardOptions into existing document safely.
// Accepts values as arrays OR JSON-stringified arrays (to support the frontend behavior).
interface IStudyProgressModel extends Model<IStudyProgress> {
  mergeCardOptions(userId: string, flashcardId: string, cardOptions: Record<string, string[] | string>): Promise<IStudyProgress>;
}

StudyProgressSchema.statics.mergeCardOptions = async function (userId: string, flashcardId: string, cardOptions: Record<string, string[] | string>) {
  const userObj = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;
  const flashcardObj = Types.ObjectId.isValid(flashcardId) ? new Types.ObjectId(flashcardId) : flashcardId;

  // find or create progress
  let doc = await this.findOne({ user: userObj, flashcard: flashcardObj });
  if (!doc) {
    doc = await this.create({ user: userObj, flashcard: flashcardObj });
  }

  // ensure map exists
  if (!doc.learn) doc.learn = ({} as any);
  if (!doc.learn.cardOptions) doc.learn.cardOptions = new Map();

  for (const [cardId, rawVal] of Object.entries(cardOptions || {})) {
    try {
      let arr: string[] = [];

      if (Array.isArray(rawVal)) {
        arr = rawVal.map(String);
      } else if (typeof rawVal === 'string') {
        try {
          const parsed = JSON.parse(rawVal);
          if (Array.isArray(parsed)) arr = parsed.map(String);
          else arr = [String(parsed)];
        } catch {
          // not JSON, treat as single CSV or single value
          if (rawVal.includes(',')) {
            arr = rawVal.split(',').map(s => s.trim()).filter(Boolean);
          } else {
            arr = [rawVal];
          }
        }
      } else {
        arr = [String(rawVal)];
      }

      // only set if we have at least one value
      if (arr.length > 0) {
        // normalize: remove duplicates, trim
        const normalized = Array.from(new Set(arr.map(s => s.trim()).filter(Boolean)));
        (doc.learn.cardOptions as Map<string, string[]>).set(cardId, normalized);
      }
    } catch (err) {
      // continue on error for other entries
      // (server logs should capture this; keep handler resilient)
      // eslint-disable-next-line no-console
      console.warn(`mergeCardOptions: failed to process card ${cardId}`, err);
    }
  }

  await doc.save();
  return doc;
};

export default (models.StudyProgress as Model<IStudyProgress, IStudyProgressModel>) || model<IStudyProgress, IStudyProgressModel>('StudyProgress', StudyProgressSchema);