const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema(
  {
    communication: {
      type: Number,
      min: 0,
      max: 100,
    },
    clarity: {
      type: Number,
      min: 0,
      max: 100,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
    },
    contentQuality: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const evaluationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "sessionModel",
      required: true,
    },

    evaluatorType: {
      type: String,
      enum: ["AI", "HUMAN"],
      required: true,
      default: "AI",
    },

    raterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userModel",
      required: function () {
        return this.evaluatorType === "HUMAN";
      },
    },

    modelVersion: {
      type: String,
      trim: true,
      required: function () {
        return this.evaluatorType === "AI";
      },
    },

    rubricVersion: {
      type: String,
      required: true,
      trim: true,
      default: "1.0.0",
    },

    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED"],
      default: "DRAFT",
    },

    scores: {
      type: scoreSchema,
      default: () => ({}),
      validate: {
        validator: function (scores) {
          if (this.status !== "SUBMITTED") {
            return true;
          }

          return [
            "communication",
            "clarity",
            "confidence",
            "contentQuality",
          ].every((field) => Number.isFinite(scores?.[field]));
        },
        message: "All rubric scores are required before submission",
      },
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

    evidenceNote: {
      type: String,
      trim: true,
      required: function () {
        return this.evaluatorType === "HUMAN" && this.status === "SUBMITTED";
      },
    },

    submittedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "evaluations",
  }
);

evaluationSchema.pre("validate", function () {
  const scores = this.scores;
  const hasAllScores = [
    scores?.communication,
    scores?.clarity,
    scores?.confidence,
    scores?.contentQuality,
  ].every(Number.isFinite);

  if (hasAllScores) {
    const weightedScore =
      scores.communication * 0.3 +
      scores.clarity * 0.25 +
      scores.confidence * 0.2 +
      scores.contentQuality * 0.25;

    this.overallScore = Math.round(weightedScore * 100) / 100;
  } else {
    this.overallScore = undefined;
  }

  if (this.status === "SUBMITTED" && !this.submittedAt) {
    this.submittedAt = new Date();
  }
});

evaluationSchema.index({ sessionId: 1 });
evaluationSchema.index(
  { sessionId: 1, evaluatorType: 1, modelVersion: 1, rubricVersion: 1 },
  {
    unique: true,
    partialFilterExpression: {
      evaluatorType: "AI",
      status: "SUBMITTED",
    },
    name: "unique_submitted_ai_evaluation",
  }
);
evaluationSchema.index(
  { sessionId: 1, evaluatorType: 1, rubricVersion: 1 },
  {
    unique: true,
    partialFilterExpression: {
      evaluatorType: "HUMAN",
      status: "SUBMITTED",
    },
    name: "unique_submitted_human_evaluation",
  }
);

module.exports = mongoose.model("evaluationModel", evaluationSchema);
