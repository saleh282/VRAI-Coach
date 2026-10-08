const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

// Verify a Bearer JWT and attach the current account identity to the request.
const requireAuth = async (req, res, next) => {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "A valid Bearer token is required",
      },
    });
  }

  // The signing key is server-only; a missing key is a server configuration error.
  if (!process.env.JWT_SECRET) {
    return next(new Error("JWT_SECRET is missing from the environment"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    // Check that the account still exists and get its current role from MongoDB.
    const user = await User.findById(payload.sub).select("role");

    if (!user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "The account for this token no longer exists",
        },
      });
    }

    req.auth = {
      userId: user._id.toString(),
      role: user.role,
    };
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: {
          code: "INVALID_TOKEN",
          message: "The access token is invalid or expired",
        },
      });
    }

    return next(error);
  }
};

// Restrict a route to one or more account roles after requireAuth has run.
const allowRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.auth || !allowedRoles.includes(req.auth.role)) {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource",
      },
    });
  }

  return next();
};

module.exports = { requireAuth, allowRoles };
