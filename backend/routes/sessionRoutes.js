const express = require("express");
const {
  createSession,
  ensureSessionCanReceiveUpload,
  uploadSessionMedia,
} = require("../controllers/sessionController");
const { requireAuth } = require("../middleware/authMiddleware");
const { uploadSessionFiles } = require("../middleware/sessionUploadMiddleware");

const router = express.Router();

// Create a session for the user identified by the Bearer token.
router.post("/", requireAuth, createSession);

// Upload the two artifacts for an owned session after verifying its state.
router.post(
  "/:sessionId/upload",
  requireAuth,
  ensureSessionCanReceiveUpload,
  uploadSessionFiles,
  uploadSessionMedia
);

module.exports = router;
