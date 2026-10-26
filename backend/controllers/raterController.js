const mongoose = require("mongoose");

const Session = require("../models/sessionModel");
const Evaluation = require("../models/evaluationModel");

// raterId comes from the authenticated user, not from the session owner.
// GET /api/v1/rater/sessions

const getRaterSessions = async (req, res) => {
  try {
    const { status } = req.query;

    const allowedStatuses = ["unreviewed", "completed"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message:
          "Invalid status. Use 'unreviewed' or 'completed'.",
      });
    }

    // Raters should only see sessions whose recording/upload is complete.
    const filter = { status: "completed" };

    const sessions = await Session.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const sessionIds = sessions.map((session) => session._id);

    const raterId = req.auth.userId;
    const humanEvaluations = await Evaluation.find({
      sessionId: { $in: sessionIds },
      raterId,
      evaluatorType: "HUMAN",
      status: "SUBMITTED",
    })
      .select("sessionId")
      .lean();

    const evaluatedSessionIds = new Set(
      humanEvaluations.map((evaluation) =>
        evaluation.sessionId.toString()
      )
    );

    let result = sessions.map((session) => ({
      ...session,
      hasHumanEvaluation: evaluatedSessionIds.has(
        session._id.toString()
      ),
    }));

    // A session is considered reviewed only for the currently authenticated rater.
    if (status === "unreviewed") {
      result = result.filter(
        (session) =>
          !session.hasHumanEvaluation
      );
    }

    return res.status(200).json({
      count: result.length,
      sessions: result,
    });
  } catch (error) {
    console.error("Error fetching rater sessions:", error);

    return res.status(500).json({
      message: "Failed to fetch sessions",
    });
  }
};



// GET /api/v1/rater/sessions/:sessionId
const getRaterSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        message: "Invalid session ID",
      });
    }

    // Do not expose an unfinished session to the rater workspace.
    const session = await Session.findOne({
      _id: sessionId,
      status: "completed",
    })
      .select(
        "_id userId sessionType category difficulty status transcriptRef audioRef videoRef startedAt completedAt createdAt"
      )
      .lean();

    if (!session) {
      return res.status(404).json({
        message: "Completed session not found",
      });
    }

    // Report submission state without loading or returning any AI scores.
    const humanEvaluation = await Evaluation.findOne({
      sessionId,
      raterId: req.auth.userId,
      evaluatorType: "HUMAN",
      status: "SUBMITTED",
    })
      .select("_id")
      .lean();

    return res.status(200).json({
      session,
      hasHumanEvaluation: !!humanEvaluation,
    });
  } catch (error) {
    console.error("Error fetching rater session:", error);

    return res.status(500).json({
      message: "Failed to fetch session",
    });
  }
};


// POST /api/v1/rater/sessions/:sessionId/evaluation
const submitRaterEvaluation = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        message: "Invalid session ID",
      });
    }

    // A human rating is accepted only after its session is completed.
    const session = await Session.findOne({
      _id: sessionId,
      status: "completed",
    });

    if (!session) {
      return res.status(404).json({
        message: "Completed session not found",
      });
    }

    const {
      communication,
      clarity,
      confidence,
      contentQuality,
      evidenceNote,
    } = req.body;

    // Enforce the shared 0–100 rubric before saving anything.
    const scores = {
      communication,
      clarity,
      confidence,
      contentQuality,
    };

    for (const [field, value] of Object.entries(scores)) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100
      ) {
        return res.status(400).json({
          message: `${field} must be a number between 0 and 100`,
        });
      }
    }

    // Evidence notes explain which observable behavior supports the scores.
    if (
      typeof evidenceNote !== "string" ||
      evidenceNote.trim().length === 0
    ) {
      return res.status(400).json({
        message: "evidenceNote is required",
      });
    }

    // Prevent only this authenticated rater from submitting a duplicate.
    // Other raters may independently evaluate the same session.
    const raterId = req.auth.userId;
    const rubricVersion = "1.0.0";
    const existingEvaluation = await Evaluation.findOne({
      sessionId,
      raterId,
      evaluatorType: "HUMAN",
      rubricVersion,
      status: "SUBMITTED",
    });

    if (existingEvaluation) {
      return res.status(409).json({
        message: "You have already evaluated this session",
      });
    }

    const evaluation = new Evaluation({
      sessionId,
      evaluatorType: "HUMAN",
      raterId,

      rubricVersion,
      status: "SUBMITTED",

      scores,
      evidenceNote: evidenceNote.trim(),
    });

    // evaluationModel calculates the weighted overallScore before validation.
    await evaluation.save();

    return res.status(201).json({
      message: "Human evaluation submitted successfully",
      evaluation: {
        id: evaluation._id,
        sessionId: evaluation.sessionId,
        evaluatorType: evaluation.evaluatorType,
        raterId: evaluation.raterId,
        rubricVersion: evaluation.rubricVersion,
        status: evaluation.status,
        scores: evaluation.scores,
        overallScore: evaluation.overallScore,
        evidenceNote: evaluation.evidenceNote,
        submittedAt: evaluation.submittedAt,
      },
    });
  } catch (error) {
    console.error("Error submitting human evaluation:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "You have already evaluated this session",
      });
    }

    return res.status(500).json({
      message: "Failed to submit evaluation",
    });
  }
};


module.exports = {
  getRaterSessions,
  getRaterSession,
  submitRaterEvaluation,
};