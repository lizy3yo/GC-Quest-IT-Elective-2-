import mongoose, { Schema, Document, Model } from "mongoose";

export interface IResource extends Document {
  title: string;
  description: string;
  type: "pdf" | "video" | "audio" | "link" | "document";
  category: string;
  subject: string;
  url: string;
  thumbnailUrl?: string;
  author?: string;
  source?: string;
  downloads: number;
  views: number;
  bookmarkedBy: mongoose.Types.ObjectId[];
  tags: string[];
  uploadedBy?: mongoose.Types.ObjectId;
  classId?: mongoose.Types.ObjectId;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<IResource>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["pdf", "video", "audio", "link", "document"],
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    author: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
    },
    downloads: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    bookmarkedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
ResourceSchema.index({ subject: 1, category: 1 });
ResourceSchema.index({ type: 1 });
ResourceSchema.index({ tags: 1 });
ResourceSchema.index({ bookmarkedBy: 1 });
ResourceSchema.index({ createdAt: -1 });
ResourceSchema.index({ classId: 1 });
ResourceSchema.index({ isVerified: 1, classId: 1 });

// Text index for search
ResourceSchema.index({ title: "text", description: "text", tags: "text" });

const Resource: Model<IResource> =
  mongoose.models.Resource || mongoose.model<IResource>("Resource", ResourceSchema);

export default Resource;
