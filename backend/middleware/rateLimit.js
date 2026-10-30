const { rateLimit } = require("express-rate-limit");

// Limits per client IP. Responses use the same error shape as the rest of the API.
const limiter = (windowMinutes, limit, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ error: { code: "RATE_LIMITED", message } }),
  });

module.exports = {
  // Sign-in and sign-up attempts.
  authLimiter: limiter(15, 50, "Too many attempts. Try again in a few minutes"),
  // Anything that sends an email or checks a code.
  otpLimiter: limiter(15, 30, "Too many code requests. Try again in a few minutes"),
};
