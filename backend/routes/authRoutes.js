const express = require("express");
const {
  googleSignIn,
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getCurrentUser,
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");
const { authLimiter, otpLimiter } = require("../middleware/rateLimit");

const router = express.Router();

// Account creation and email verification.
router.post("/register", authLimiter, register);
router.post("/verify-email", otpLimiter, verifyEmail);
router.post("/resend-verification", otpLimiter, resendVerification);

// Sign-in and tokens.
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, googleSignIn);
router.post("/refresh", refresh);
router.post("/logout", logout);

// Forgot password.
router.post("/forgot-password", otpLimiter, forgotPassword);
router.post("/reset-password", otpLimiter, resetPassword);

// Return the signed-in user's public profile; a valid JWT is required.
router.get("/me", requireAuth, getCurrentUser);

module.exports = router;
