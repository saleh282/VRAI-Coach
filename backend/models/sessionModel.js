const mongoose = require("mongoose");

// One interview attempt owned by a user. Media fields store storage references,
// not the audio/video/motion file contents themselves.
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
      // Tracks the session lifecycle; routes will move it through these states.
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled", "failed"],
      default: "pending",
    },

    transcriptRef: {
      // Optional pointer to a transcript in file/object storage.
      type: String,
      trim: true,
    },

    audioRef: {
      // Optional pointer to the recorded headset audio.
      type: String,
      trim: true,
    },

    videoRef: {
      // Optional pointer to the screen recording.
      type: String,
      trim: true,
    },

    motionRef: {
      // Optional pointer to the motion-tracking JSON log.
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

// Support a user's newest-session history and status-based workflow queries.
sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ status: 1 });

module.exports = mongoose.model("sessionModel", sessionSchema);
