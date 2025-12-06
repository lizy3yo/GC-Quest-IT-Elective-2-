import mongoose, { Schema, model, models, Types } from 'mongoose';

export interface IActivity {
  user: Types.ObjectId | string;
  type: string; // e.g. 'flashcard.generate', 'summary.create', 'practice_test.attempt'
  action: string; // short action name
  meta?: any; // arbitrary metadata about the action
  progress?: number; // 0-100 progress for long-running actions
  createdAt?: Date;
  updatedAt?: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, index: true },
    action: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
    progress: { type: Number, min: 0, max: 100 }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient user activity queries
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ user: 1, type: 1 });

export default models.Activity || model<IActivity>('Activity', activitySchema);
