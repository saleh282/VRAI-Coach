const fs = require("fs/promises");
const mongoose = require("mongoose");
const path = require("path");
const Session = require("../models/sessionModel");

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
  ensureSessionCanReceiveUpload,
  uploadSessionMedia,
};
