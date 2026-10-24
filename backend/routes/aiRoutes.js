const express = require("express");
const { submitAiEvaluation } = require("../controllers/aiController");
const { requireAiServiceKey } = require("../middleware/aiServiceMiddleware");

const router = express.Router();

// This route is for the trusted AI backend service, not mobile/VR clients.
router.post(
  "/sessions/:sessionId/evaluation",
  requireAiServiceKey,
  submitAiEvaluation
);

module.exports = router;
