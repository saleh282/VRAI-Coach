const Session = require("../models/sessionModel");

const createSession = async (req, res, next) => {
  try {
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

    const session = await Session.create({
      userId: req.auth.userId,
      sessionType: "interview",
      category,
      difficulty,
      status: "pending",
    });

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

module.exports = { createSession };
