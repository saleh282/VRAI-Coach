const express = require("express");

const {
  getRaterSessions,
  getRaterSession,
  submitRaterEvaluation,
} = require("../controllers/raterController");

const router = express.Router();

// Rater workflow endpoints. Add authentication and role authorization before
// exposing these routes to real users; they are currently unprotected.
router.get("/sessions", getRaterSessions);

router.get("/sessions/:sessionId", getRaterSession);

router.post(
  "/sessions/:sessionId/evaluation",
  submitRaterEvaluation
);

module.exports = router;
