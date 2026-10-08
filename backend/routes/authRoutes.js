const express = require("express");
const {
  register,
  login,
  getCurrentUser,
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// Public account creation and sign-in endpoints.
router.post("/register", register);
router.post("/login", login);

// Return the signed-in user's public profile; a valid JWT is required.
router.get("/me", requireAuth, getCurrentUser);

module.exports = router;
