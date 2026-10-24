const fs = require("fs/promises");
const mongoose = require("mongoose");
const path = require("path");
const Session = require("../models/sessionModel");
const Evaluation = require("../models/evaluationModel");

// GET /api/v1/sessions/me — return only the signed-in user's session summaries.
const getMySessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ userId: req.auth.userId })
      .select("_id category difficulty status createdAt completedAt")
      .sort({ createdAt: -1 })
      .lean();

    const sessionIds = sessions.map((session) => session._id);
    const aiEvaluations = sessionIds.length
      ? await Evaluation.find({
          sessionId: { $in: sessionIds },
          evaluatorType: "AI",
          status: "SUBMITTED",
        })
          .select("sessionId submittedAt")
          .sort({ submittedAt: -1 })
          .lean()
      : [];

    const sessionsWithResults = new Set(
      aiEvaluations.map((evaluation) => evaluation.sessionId.toString())
    );

    return res.status(200).json({
      data: {
        sessions: sessions.map((session) => ({
          sessionId: session._id.toString(),
          category: session.category,
          difficulty: session.difficulty,
          status: session.status,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          resultStatus: sessionsWithResults.has(session._id.toString())
            ? "ready"
            : "pending",
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/sessions/:sessionId — return owned session details and its AI result only.
const getMySessionDetails = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        error: { code: "INVALID_SESSION_ID", message: "Session ID is invalid" },
      });
    }

    const session = await Session.findOne({
      _id: sessionId,
      userId: req.auth.userId,
    })
      .select("_id category difficulty status createdAt startedAt completedAt")
      .lean();

    // Use the same response for missing and non-owned sessions to avoid leaking their existence.
    if (!session) {
      return res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: "Session was not found" },
      });
    }

    const evaluation = await Evaluation.findOne({
      sessionId: session._id,
      evaluatorType: "AI",
      status: "SUBMITTED",
    })
      .select("scores overallScore feedback modelVersion rubricVersion submittedAt")
      .sort({ submittedAt: -1 })
      .lean();

    return res.status(200).json({
      data: {
        session: {
          sessionId: session._id.toString(),
          category: session.category,
          difficulty: session.difficulty,
          status: session.status,
          createdAt: session.createdAt,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
        },
        result: evaluation
          ? {
              status: "ready",
              evaluatorType: "AI",
              scores: evaluation.scores,
              overallScore: evaluation.overallScore,
              feedback: evaluation.feedback,
              modelVersion: evaluation.modelVersion,
              rubricVersion: evaluation.rubricVersion,
              submittedAt: evaluation.submittedAt,
            }
          : { status: "pending" },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Confirm the session exists and belongs to the signed-in user before Multer writes files.
const ensureSessionCanReceiveUpload = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        error: { code: "INVALID_SESSION_ID", message: "Session ID is invalid" },
      });
    }

    const session = await Session.findOne({
      _id: sessionId,
      userId: req.auth.userId,
    });

    if (!session) {
      return res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: "Session was not found" },
      });
    }

    if (!["pending", "in_progress"].includes(session.status)) {
      return res.status(409).json({
        error: { code: "SESSION_NOT_UPLOADABLE", message: "Session cannot receive uploads in its current status" },
      });
    }

    if (session.audioRef || session.motionRef) {
      return res.status(409).json({
        error: { code: "MEDIA_ALREADY_UPLOADED", message: "Media has already been uploaded for this session" },
      });
    }

    req.session = session;
    return next();
  } catch (error) {
    return next(error);
  }
};

const removeUploadedFiles = async (files = []) => {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
};

// Save file references in MongoDB; media bytes stay in local storage, not in MongoDB.
const uploadSessionMedia = async (req, res, next) => {
  const files = Object.values(req.files || {}).flat();

  try {
    const audio = req.files?.audio?.[0];
    const motionLog = req.files?.motionLog?.[0];

    if (!audio || !motionLog) {
      await removeUploadedFiles(files);
      return res.status(400).json({
        error: {
          code: "MISSING_SESSION_MEDIA",
          message: "Both audio (.wav) and motionLog (.json) files are required",
        },
      });
    }

    try {
      JSON.parse(await fs.readFile(motionLog.path, "utf8"));
    } catch {
      await removeUploadedFiles(files);
      return res.status(400).json({
        error: { code: "INVALID_MOTION_JSON", message: "motionLog must contain valid JSON" },
      });
    }

    const session = req.session;
    const sessionFolder = `sessions/${session._id.toString()}`;
    session.audioRef = path.posix.join(sessionFolder, "audio.wav");
    session.motionRef = path.posix.join(sessionFolder, "motion.json");
    session.status = "completed";
    session.completedAt = new Date();

    await session.save();

    return res.status(200).json({
      data: {
        sessionId: session._id.toString(),
        status: session.status,
        completedAt: session.completedAt,
        files: {
          audio: session.audioRef,
          motionLog: session.motionRef,
        },
      },
    });
  } catch (error) {
    await removeUploadedFiles(files);
    return next(error);
  }
};

const createSession = async (req, res, next) => {
  try {
    // The client selects the interview type; ownership comes from the JWT.
    const { category, difficulty } = req.body || {};
    const validCategories = ["tech", "soft_skills"];
    const validDifficulties = ["easy", "medium", "hard"];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: {
          code: "INVALID_CATEGORY",
          message: "Category must be either 'tech' or 'soft_skills'",
        },
      });
    }

    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: {
          code: "INVALID_DIFFICULTY",
          message: "Difficulty must be 'easy', 'medium', or 'hard'",
        },
      });
    }

    // Create the initial record; VR uploads audio and motion after the session ends.
    const session = await Session.create({
      userId: req.auth.userId,
      sessionType: "interview",
      category,
      difficulty,
      status: "pending",
    });

    // MongoDB's generated _id is the sessionId shared with the other services.
    return res.status(201).json({
      data: {
        sessionId: session._id.toString(),
        status: session.status,
        sessionType: session.sessionType,
        category: session.category,
        difficulty: session.difficulty,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createSession,
  getMySessions,
  getMySessionDetails,
  ensureSessionCanReceiveUpload,
  uploadSessionMedia,
};
