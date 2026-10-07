const express = require("express");
const { createSession } = require("../controllers/sessionController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", requireAuth, createSession);

module.exports = router;
