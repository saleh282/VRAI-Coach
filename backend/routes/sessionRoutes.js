const express = require("express");
const { createSession } = require("../controllers/sessionController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// Create a session for the user identified by the Bearer token.
router.post("/", requireAuth, createSession);

module.exports = router;
