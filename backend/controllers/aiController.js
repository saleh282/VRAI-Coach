const mongoose = require("mongoose");
const Evaluation = require("../models/evaluationModel");
const Session = require("../models/sessionModel");

const SCORE_FIELDS = [
  "communication",
  "clarity",
  "confidence",
  "contentQuality",
];

// POST /api/v1/ai/sessions/:sessionId/evaluation
const submitAiEvaluation = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        error: { code: "INVALID_SESSION_ID", message: "Session ID is invalid" },
      });
    }

    const session = await Session.findById(sessionId).select("status");
    if (!session) {
      return res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: "Session was not found" },
      });
    }

    if (session.status !== "completed") {
      return res.status(409).json({
        error: {
          code: "SESSION_NOT_COMPLETED",
          message: "AI evaluation can only be submitted for a completed session",
        },
      });
    }

    const body = req.body || {};
    const { modelVersion, rubricVersion = "1.0.0", scores, feedback } = body;

    if (typeof modelVersion !== "string" || !modelVersion.trim()) {
      return res.status(400).json({
        error: { code: "INVALID_MODEL_VERSION", message: "modelVersion is required" },
      });
    }

    if (typeof rubricVersion !== "string" || !rubricVersion.trim()) {
      return res.status(400).json({
        error: { code: "INVALID_RUBRIC_VERSION", message: "rubricVersion must be a non-empty string" },
      });
    }

    if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
      return res.status(400).json({
        error: { code: "INVALID_SCORES", message: "scores must be an object containing all rubric fields" },
      });
    }

    for (const field of SCORE_FIELDS) {
      const value = scores[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
        return res.status(400).json({
          error: {
            code: "INVALID_SCORE",
            message: `${field} must be a number between 0 and 100`,
          },
        });
      }
    }

    if (feedback !== undefined && typeof feedback !== "string") {
      return res.status(400).json({
        error: { code: "INVALID_FEEDBACK", message: "feedback must be a string" },
      });
    }

    const normalizedModelVersion = modelVersion.trim();
    const normalizedRubricVersion = rubricVersion.trim();
    const existingEvaluation = await Evaluation.findOne({
      sessionId,
      evaluatorType: "AI",
      modelVersion: normalizedModelVersion,
      rubricVersion: normalizedRubricVersion,
      status: "SUBMITTED",
    }).select("_id");

    if (existingEvaluation) {
      return res.status(409).json({
        error: {
          code: "AI_EVALUATION_ALREADY_EXISTS",
          message: "A submitted AI evaluation already exists for this model and rubric version",
        },
      });
    }

    const evaluation = new Evaluation({
      sessionId,
      evaluatorType: "AI",
      modelVersion: normalizedModelVersion,
      rubricVersion: normalizedRubricVersion,
      status: "SUBMITTED",
      scores: Object.fromEntries(SCORE_FIELDS.map((field) => [field, scores[field]])),
      ...(feedback === undefined ? {} : { feedback: feedback.trim() }),
    });

    // The Evaluation model calculates overallScore server-side from the four rubric scores.
    await evaluation.save();

    return res.status(201).json({
      data: {
        evaluationId: evaluation._id.toString(),
        sessionId: sessionId.toString(),
        evaluatorType: evaluation.evaluatorType,
        status: evaluation.status,
        modelVersion: evaluation.modelVersion,
        rubricVersion: evaluation.rubricVersion,
        scores: evaluation.scores,
        overallScore: evaluation.overallScore,
        feedback: evaluation.feedback,
        submittedAt: evaluation.submittedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: {
          code: "AI_EVALUATION_ALREADY_EXISTS",
          message: "A submitted AI evaluation already exists for this model and rubric version",
        },
      });
    }

    return next(error);
  }
};

module.exports = { submitAiEvaluation };
