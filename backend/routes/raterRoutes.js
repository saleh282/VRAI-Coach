const express = require("express");

const {
  getRaterSessions,
  getRaterSession,
  submitRaterEvaluation,
} = require("../controllers/raterController");

const router = express.Router();

router.get("/sessions", getRaterSessions);

router.get("/sessions/:sessionId", getRaterSession);

router.post(
  "/sessions/:sessionId/evaluation",
  submitRaterEvaluation
);

module.exports = router;