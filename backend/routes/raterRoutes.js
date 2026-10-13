const express = require("express");

const {
  getRaterSessions,
  getRaterSession,
  submitRaterEvaluation,
} = require("../controllers/raterController");

const { requireAuth, allowRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Authentication and role authorization for all Rater endpoints. 
router.use(requireAuth, allowRoles("rater"));

// Get all completed sessions, whether evaluated or not.
router.get("/sessions", getRaterSessions);

router.get("/sessions/:sessionId", getRaterSession);

// Submit a human evaluation for a session.
router.post(
  "/sessions/:sessionId/evaluation",
  submitRaterEvaluation
);

module.exports = router;
