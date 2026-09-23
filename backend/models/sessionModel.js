const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userModel",
      required: true,
    },

    sessionType: {
      type: String,
      enum: ["interview"],
      required: true,
      default: "interview",
    },

    category: {
      type: String,
      enum: ["tech", "soft_skills"],
      required: true,
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled", "failed"],
      default: "pending",
    },

    transcriptRef: {
      type: String,
      trim: true,
    },

    audioRef: {
      type: String,
      trim: true,
    },

    videoRef: {
      type: String,
      trim: true,
    },

    startedAt: {
      type: Date,
    },

    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "sessions",
  }
);

sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ status: 1 });

module.exports = mongoose.model("sessionModel", sessionSchema);
