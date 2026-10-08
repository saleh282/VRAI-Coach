const Session = require("../models/sessionModel");

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

    // Create the initial record only. Media upload is a separate, not-yet-built flow.
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

module.exports = { createSession };
