const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const BCRYPT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only expose safe profile fields; never return passwordHash in an API response.
const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
});

const createAccessToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from the environment");
  }

  // Put the user's ID in the JWT subject and include their role for authorization.
  return jwt.sign(
    { role: user.role },
    process.env.JWT_SECRET,
    {
      subject: user._id.toString(),
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    }
  );
};

const register = async (req, res, next) => {
  try {
    // Registration accepts credentials, but not a role chosen by the client.
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Name, email, and password are required",
        },
      });
    }

    // Normalize email before validation and storage so casing is consistent.
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({
        error: {
          code: "INVALID_EMAIL",
          message: "Enter a valid email address",
        },
      });
    }

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        error: {
          code: "INVALID_PASSWORD",
          message: "Password must be at least 8 characters and at most 72 bytes",
        },
      });
    }

    // Store only a one-way password hash, never the original password.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      // Never accept a role from public registration input.
    });

    const accessToken = createAccessToken(user);
    return res.status(201).json({
      data: {
        accessToken,
        user: publicUser(user),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_REGISTERED",
          message: "An account with this email already exists",
        },
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Registration data is invalid",
        },
      });
    }

    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required",
        },
      });
    }

    // Compare the supplied password with the saved hash; don't reveal which
    // credential was wrong in the response.
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!passwordMatches) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect",
        },
      });
    }

    const accessToken = createAccessToken(user);
    return res.status(200).json({
      data: {
        accessToken,
        user: publicUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    // req.auth is populated by requireAuth after verifying the Bearer token.
    const user = await User.findById(req.auth.userId);

    if (!user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "The account for this token no longer exists",
        },
      });
    }

    return res.status(200).json({ data: { user: publicUser(user) } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, getCurrentUser };
