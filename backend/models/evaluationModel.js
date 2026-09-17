const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "sessionModel",
      required: true,
    },

    type: {
      type: String,
      enum: ["AI", "HUMAN"],
      required: true,
      default: "AI",
    },

    scores: {
      type: Map,
      of: Number,
      default: {},
    },

    overallScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    feedback: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("evaluationModel", evaluationSchema);