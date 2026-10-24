const { timingSafeEqual } = require("crypto");

// Authenticate the trusted AI service with a server-side shared secret.
const requireAiServiceKey = (req, res, next) => {
  const expectedKey = process.env.AI_SERVICE_API_KEY;
  const providedKey = req.get("x-api-key") || "";

  if (!expectedKey) {
    return res.status(503).json({
      error: {
        code: "AI_SERVICE_AUTH_NOT_CONFIGURED",
        message: "AI service authentication is not configured",
      },
    });
  }

  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  const matches = expected.length === provided.length
    && timingSafeEqual(expected, provided);

  if (!matches) {
    return res.status(401).json({
      error: {
        code: "INVALID_AI_SERVICE_KEY",
        message: "A valid AI service API key is required",
      },
    });
  }

  return next();
};

module.exports = { requireAiServiceKey };
