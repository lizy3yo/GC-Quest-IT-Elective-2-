import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStudyRoom extends Document {
  name: string;
  description: string;
  subject: string;
  isPrivate: boolean;
  createdBy: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  maxMembers: number;
  pendingInvites: {
    userId: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    invitedAt: Date;
  }[];
  messages: {
    userId: mongoose.Types.ObjectId;
    message: string;
    editHistory?: { message: string; editedAt: Date }[];
    isEdited?: boolean;
    timestamp: Date;
    type?: 'message' | 'system';
    deletedForEveryone?: boolean;
    deletedFor?: mongoose.Types.ObjectId[];
  }[];
  notes: {
    userId: mongoose.Types.ObjectId;
    title: string;
    content: string;
    createdAt: Date;
  }[];
  challenges: {
    createdBy: mongoose.Types.ObjectId;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    responses: {
      userId: mongoose.Types.ObjectId;
      selectedOption: number;
      isCorrect: boolean;
      answeredAt: Date;
    }[];
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const StudyRoomSchema = new Schema<IStudyRoom>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    maxMembers: {
      type: Number,
      default: 10,
      min: 2,
      max: 50,
    },
    pendingInvites: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        invitedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        invitedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    messages: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        editHistory: [
          {
            message: { type: String, required: true },
            editedAt: { type: Date, default: Date.now },
          },
        ],
        isEdited: {
          type: Boolean,
          default: false,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        type: {
          type: String,
          enum: ['message', 'system'],
          default: 'message',
        },
        deletedForEveryone: {
          type: Boolean,
          default: false,
        },
        deletedFor: [
          {
            type: Schema.Types.ObjectId,
            ref: "User",
          },
        ],
      },
    ],
    notes: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        title: {
          type: String,
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    challenges: [
      {
        createdBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        question: {
          type: String,
          required: true,
        },
        options: [
          {
            type: String,
            required: true,
          },
        ],
        correctAnswer: {
          type: Number,
          required: true,
        },
        explanation: {
          type: String,
          required: true,
        },
        responses: [
          {
            userId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            selectedOption: {
              type: Number,
              required: true,
            },
            isCorrect: {
              type: Boolean,
              required: true,
            },
            answeredAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
StudyRoomSchema.index({ subject: 1, createdAt: -1 }); // Browse by subject
StudyRoomSchema.index({ members: 1 }); // Find user's study rooms
StudyRoomSchema.index({ createdBy: 1, createdAt: -1 }); // Creator's rooms
StudyRoomSchema.index({ isPrivate: 1, subject: 1 }); // Public rooms by subject
StudyRoomSchema.index({ 'pendingInvites.userId': 1 }); // User's pending invites
StudyRoomSchema.index({ subject: 1, isPrivate: 1, createdAt: -1 }); // Compound for browsing

const StudyRoom: Model<IStudyRoom> =
  mongoose.models.StudyRoom || mongoose.model<IStudyRoom>("StudyRoom", StudyRoomSchema);

export default StudyRoom;
