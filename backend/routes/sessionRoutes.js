const express = require("express");
const {
  createSession,
  getMySessions,
  getMySessionDetails,
  ensureSessionCanReceiveUpload,
  uploadSessionMedia,
} = require("../controllers/sessionController");
const { requireAuth, allowRoles } = require("../middleware/authMiddleware");
const { uploadSessionFiles } = require("../middleware/sessionUploadMiddleware");

const router = express.Router();

// List only sessions owned by the signed-in user.
router.get("/me", requireAuth, allowRoles("user"), getMySessions);

// Create a session for the user identified by the Bearer token.
router.post("/", requireAuth, allowRoles("user"), createSession);

// Read one owned session and its AI result (never a human rater's private record).
router.get(
  "/:sessionId",
  requireAuth,
  allowRoles("user"),
  getMySessionDetails
);

// Upload the two artifacts for an owned session after verifying its state.
router.post(
  "/:sessionId/upload",
  requireAuth,
  allowRoles("user"),
  ensureSessionCanReceiveUpload,
  uploadSessionFiles,
  uploadSessionMedia
);

module.exports = router;
