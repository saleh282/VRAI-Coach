const mongoose = require("mongoose");

const Session = require("../models/sessionModel");
const Evaluation = require("../models/evaluationModel");

// GET /api/v1/rater/sessions
const getRaterSessions = async (req, res) => {
  try {
    const { status } = req.query;

    if (status && status !== "pending" && status !== "all") {
      return res.status(400).json({
        message: "Invalid status. Use 'pending' or 'all'.",
      });
    }

    // Get all completed sessions
    const sessions = await Session.find({
      status: "completed",
    })
      .sort({ completedAt: -1 })
      .lean();

    const sessionIds = sessions.map((session) => session._id);

    // Get submitted HUMAN evaluations only
    const humanEvaluations = await Evaluation.find({
      sessionId: { $in: sessionIds },
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

    // Return only sessions that haven't been evaluated by a human
    if (status === "pending") {
      result = result.filter(
        (session) => !session.hasHumanEvaluation
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

    // Only completed sessions can be reviewed
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

    // Check whether a HUMAN evaluation already exists
    const humanEvaluation = await Evaluation.findOne({
      sessionId,
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

    // Make sure the session exists and is completed
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

    // Validate scores
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

    // Required for submitted HUMAN evaluations
    if (
      typeof evidenceNote !== "string" ||
      evidenceNote.trim().length === 0
    ) {
      return res.status(400).json({
        message: "evidenceNote is required",
      });
    }

    // Prevent duplicate HUMAN evaluations
    const existingEvaluation = await Evaluation.findOne({
      sessionId,
      evaluatorType: "HUMAN",
      status: "SUBMITTED",
    });

    if (existingEvaluation) {
      return res.status(409).json({
        message: "This session has already been evaluated by a human",
      });
    }

    /*
      TEMPORARY:
      Authentication is not connected yet.

      We'll replace this with:
      const raterId = req.user.id;
      عشان اعرف اتيست بشكل مؤقت 

      after Backend-1 finishes authentication.
    */

    const evaluation = new Evaluation({
      sessionId,
      evaluatorType: "HUMAN",

      // Temporary test rater ID.
      // This will be replaced by req.user.id after Auth integration.
      raterId: session.userId,

      rubricVersion: "1.0.0",
      status: "SUBMITTED",

      scores,
      evidenceNote: evidenceNote.trim(),
    });

    // evaluationModel automatically calculates
    // the weighted overallScore.
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
        message: "This session already has a submitted human evaluation",
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