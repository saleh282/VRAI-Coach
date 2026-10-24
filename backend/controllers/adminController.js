const mongoose = require("mongoose");
const Evaluation = require("../models/evaluationModel");
const Session = require("../models/sessionModel");
const User = require("../models/userModel");

const validRoles = ["user", "rater", "admin"];

const invalidId = (res, resource) => res.status(400).json({
  error: {
    code: `INVALID_${resource.toUpperCase()}_ID`,
    message: `${resource} ID is invalid`,
  },
});

// GET /api/v1/admin/users
const listUsers = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select("_id name email role createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      data: {
        users: users.map((user) => ({
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/admin/users/:userId
const getUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, "user");

    const user = await User.findById(userId)
      .select("_id name email role createdAt")
      .lean();

    if (!user) {
      return res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "User was not found" },
      });
    }

    return res.status(200).json({
      data: {
        user: {
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/v1/admin/users/:userId/role
const changeUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(userId)) return invalidId(res, "user");
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: {
          code: "INVALID_ROLE",
          message: "role must be one of: user, rater, admin",
        },
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { role } },
      { new: true, runValidators: true }
    ).select("_id name email role");

    if (!user) {
      return res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "User was not found" },
      });
    }

    return res.status(200).json({
      data: {
        user: {
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/admin/sessions
const listSessions = async (req, res, next) => {
  try {
    const { status } = req.query;
    const allowedStatuses = ["pending", "in_progress", "completed", "cancelled", "failed"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: { code: "INVALID_STATUS", message: "Session status filter is invalid" },
      });
    }

    const rawLimit = Number.parseInt(req.query.limit, 10);
    const rawOffset = Number.parseInt(req.query.offset, 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
    const filter = status ? { status } : {};

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .select("_id userId category difficulty status createdAt completedAt")
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      Session.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: {
        sessions: sessions.map((session) => ({
          sessionId: session._id.toString(),
          user: session.userId,
          category: session.category,
          difficulty: session.difficulty,
          status: session.status,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
        })),
        pagination: { limit, offset, total },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/admin/sessions/:sessionId
const getSessionReport = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) return invalidId(res, "session");

    const session = await Session.findById(sessionId)
      .select("_id userId category difficulty status createdAt startedAt completedAt audioRef motionRef")
      .populate("userId", "name email")
      .lean();

    if (!session) {
      return res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: "Session was not found" },
      });
    }

    const evaluations = await Evaluation.find({
      sessionId: session._id,
      status: "SUBMITTED",
    })
      .select("evaluatorType raterId modelVersion rubricVersion scores overallScore feedback evidenceNote submittedAt")
      .populate("raterId", "name email role")
      .sort({ submittedAt: -1 })
      .lean();

    return res.status(200).json({
      data: {
        session: {
          sessionId: session._id.toString(),
          user: session.userId,
          category: session.category,
          difficulty: session.difficulty,
          status: session.status,
          createdAt: session.createdAt,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          files: { audio: session.audioRef, motionLog: session.motionRef },
        },
        aiEvaluations: evaluations
          .filter((evaluation) => evaluation.evaluatorType === "AI")
          .map(({ evaluatorType, ...evaluation }) => ({ ...evaluation, evaluatorType })),
        humanEvaluations: evaluations
          .filter((evaluation) => evaluation.evaluatorType === "HUMAN")
          .map(({ evaluatorType, ...evaluation }) => ({ ...evaluation, evaluatorType })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/admin/raters
const listRaters = async (req, res, next) => {
  try {
    const [raters, submittedRatings] = await Promise.all([
      User.find({ role: "rater" })
        .select("_id name email role createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Evaluation.find({ evaluatorType: "HUMAN", status: "SUBMITTED" })
        .select("raterId")
        .lean(),
    ]);

    const ratingsByRater = new Map();
    for (const evaluation of submittedRatings) {
      if (!evaluation.raterId) continue;
      const id = evaluation.raterId.toString();
      ratingsByRater.set(id, (ratingsByRater.get(id) || 0) + 1);
    }

    return res.status(200).json({
      data: {
        raters: raters.map((rater) => ({
          raterId: rater._id.toString(),
          name: rater.name,
          email: rater.email,
          createdAt: rater.createdAt,
          submittedEvaluations: ratingsByRater.get(rater._id.toString()) || 0,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/admin/raters/:raterId
const getRaterDetails = async (req, res, next) => {
  try {
    const { raterId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(raterId)) return invalidId(res, "rater");

    const rater = await User.findOne({ _id: raterId, role: "rater" })
      .select("_id name email role createdAt")
      .lean();

    if (!rater) {
      return res.status(404).json({
        error: { code: "RATER_NOT_FOUND", message: "Rater was not found" },
      });
    }

    const evaluations = await Evaluation.find({
      raterId: rater._id,
      evaluatorType: "HUMAN",
      status: "SUBMITTED",
    })
      .select("sessionId rubricVersion scores overallScore evidenceNote submittedAt")
      .populate("sessionId", "category difficulty status createdAt")
      .sort({ submittedAt: -1 })
      .lean();

    return res.status(200).json({
      data: {
        rater: {
          raterId: rater._id.toString(),
          name: rater.name,
          email: rater.email,
          createdAt: rater.createdAt,
        },
        submittedEvaluations: evaluations,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listUsers,
  getUserDetails,
  changeUserRole,
  listSessions,
  getSessionReport,
  listRaters,
  getRaterDetails,
};
