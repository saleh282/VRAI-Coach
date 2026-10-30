const bcrypt = require("bcrypt");
const User = require("../models/userModel");
const otpService = require("../services/otpService");
const tokenService = require("../services/tokenService");
const googleAuth = require("../services/googleAuth");
const {
  validateGoogle,
  validateRegister,
  validateLogin,
  validateEmailOnly,
  validateEmailCode,
  validateResetPassword,
  validateRefreshToken,
} = require("../validation/authValidation");

const BCRYPT_ROUNDS = 12;

// Only expose safe profile fields; never return passwordHash in an API response.
const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  emailVerified: user.emailVerified !== false,
});

const fail = (res, status, code, message, details) =>
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });

const validationFailed = (res, errors) =>
  fail(res, 400, "VALIDATION_ERROR", Object.values(errors)[0], errors);

// The same reply whether or not the email exists, so it cannot be used to find accounts.
const GENERIC_EMAIL_REPLY = "If an account exists for this email, a code has been sent";

const OTP_ERRORS = {
  invalid: [400, "INVALID_CODE", "The code is incorrect"],
  expired: [400, "CODE_EXPIRED", "The code has expired. Request a new one"],
  too_many_attempts: [429, "TOO_MANY_ATTEMPTS", "Too many wrong codes. Request a new one"],
};

const sendTokens = async (req, res, user, status = 200, extra = {}) => {
  const tokens = await tokenService.issueTokens(user, req.get?.("user-agent"));
  return res.status(status).json({ data: { ...tokens, user: publicUser(user), ...extra } });
};

// POST /api/v1/auth/register — create an unverified account and email a code.
const register = async (req, res, next) => {
  try {
    const { value, errors } = validateRegister(req.body);
    if (errors) return validationFailed(res, errors);

    const passwordHash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);
    const user = await User.create({
      name: value.name,
      email: value.email,
      passwordHash,
      emailVerified: false,
      // Never accept a role from public registration input.
    });

    let emailSent = true;
    try {
      await otpService.issueOtp(user, "verify_email");
    } catch (error) {
      // The account exists; the client can ask for the code again.
      console.error("Verification email failed:", error.message);
      emailSent = false;
    }

    return res.status(201).json({
      data: {
        user: publicUser(user),
        verification: {
          required: true,
          emailSent,
          expiresInSec: otpService.OTP_TTL_MINUTES * 60,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, 409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
    }
    if (error.name === "ValidationError") {
      return fail(res, 400, "VALIDATION_ERROR", "Registration data is invalid");
    }
    return next(error);
  }
};

// POST /api/v1/auth/verify-email — confirm the code and sign the user in.
const verifyEmail = async (req, res, next) => {
  try {
    const { value, errors } = validateEmailCode(req.body);
    if (errors) return validationFailed(res, errors);

    const user = await User.findOne({ email: value.email });
    if (!user) return fail(res, ...OTP_ERRORS.invalid);
    if (user.emailVerified !== false) {
      return fail(res, 409, "EMAIL_ALREADY_VERIFIED", "This email is already verified. Sign in instead");
    }

    const outcome = await otpService.verifyOtp(user._id, "verify_email", value.code);
    if (outcome !== "ok") return fail(res, ...OTP_ERRORS[outcome]);

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
    return sendTokens(req, res, user);
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/auth/resend-verification
const resendVerification = async (req, res, next) => {
  try {
    const { value, errors } = validateEmailOnly(req.body);
    if (errors) return validationFailed(res, errors);

    const user = await User.findOne({ email: value.email });
    if (user && user.emailVerified === false) {
      const result = await otpService.issueOtp(user, "verify_email");
      if (!result.sent) {
        return fail(res, 429, "RESEND_TOO_SOON", `Wait ${result.retryAfterSec} seconds before asking again`,
          { retryAfterSec: result.retryAfterSec });
      }
    }
    return res.status(200).json({ data: { message: GENERIC_EMAIL_REPLY } });
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/auth/login
const login = async (req, res, next) => {
  try {
    const { value, errors } = validateLogin(req.body);
    if (errors) return validationFailed(res, errors);

    // Compare with the saved hash; don't reveal which credential was wrong.
    const user = await User.findOne({ email: value.email });
    // Accounts created with Google have no password yet.
    const passwordMatches = user?.passwordHash ? await bcrypt.compare(value.password, user.passwordHash) : false;
    if (!passwordMatches) {
      return fail(res, 401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    if (user.emailVerified === false) {
      return fail(res, 403, "EMAIL_NOT_VERIFIED", "Verify your email before signing in");
    }

    return sendTokens(req, res, user);
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/auth/google — sign in (or sign up) with a Google ID token.
const googleSignIn = async (req, res, next) => {
  try {
    if (!googleAuth.googleConfigured()) {
      return fail(res, 503, "GOOGLE_SIGN_IN_NOT_CONFIGURED", "Google sign-in is not set up on the server");
    }

    const { value, errors } = validateGoogle(req.body);
    if (errors) return validationFailed(res, errors);

    let profile;
    try {
      profile = await googleAuth.verifyGoogleIdToken(value.idToken);
    } catch {
      return fail(res, 401, "INVALID_GOOGLE_TOKEN", "Google sign-in failed. Try again");
    }
    if (!profile.email || !profile.emailVerified) {
      return fail(res, 401, "GOOGLE_EMAIL_NOT_VERIFIED", "Your Google email is not verified");
    }

    // Same Google account, or an existing account with the same email (link them).
    let user = await User.findOne({ googleId: profile.googleId })
      || await User.findOne({ email: profile.email });
    let isNewUser = false;

    if (user) {
      user.googleId = user.googleId || profile.googleId;
      // Google has confirmed the email address.
      if (user.emailVerified === false) {
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
      }
      if (user.isModified()) await user.save();
    } else {
      user = await User.create({
        name: profile.name.slice(0, 60),
        email: profile.email,
        googleId: profile.googleId,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
      isNewUser = true;
    }

    return sendTokens(req, res, user, isNewUser ? 201 : 200, { isNewUser });
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/auth/refresh — trade a refresh token for a new access + refresh pair.
const refresh = async (req, res, next) => {
  try {
    const { value, errors } = validateRefreshToken(req.body);
    if (errors) return validationFailed(res, errors);

    const outcome = await tokenService.consumeRefreshToken(value.refreshToken);
    if (outcome.error) {
      return fail(res, 401, "INVALID_REFRESH_TOKEN", "Sign in again");
    }

    const user = await User.findById(outcome.userId);
    if (!user) return fail(res, 401, "INVALID_REFRESH_TOKEN", "Sign in again");
    return sendTokens(req, res, user);
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/auth/logout — revoke this device's refresh token.
const logout = async (req, res, next) => {
  try {
    const { value, errors } = validateRefreshToken(req.body);
    if (errors) return validationFailed(res, errors);
    await tokenService.revokeRefreshToken(value.refreshToken);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/auth/forgot-password — email a reset code.
const forgotPassword = async (req, res, next) => {
  try {
    const { value, errors } = validateEmailOnly(req.body);
    if (errors) return validationFailed(res, errors);

    const user = await User.findOne({ email: value.email });
    if (user) {
      const result = await otpService.issueOtp(user, "reset_password");
      if (!result.sent) {
        return fail(res, 429, "RESEND_TOO_SOON", `Wait ${result.retryAfterSec} seconds before asking again`,
          { retryAfterSec: result.retryAfterSec });
      }
    }
    return res.status(200).json({ data: { message: GENERIC_EMAIL_REPLY } });
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/auth/reset-password — check the code, set the new password, sign out everywhere.
const resetPassword = async (req, res, next) => {
  try {
    const { value, errors } = validateResetPassword(req.body);
    if (errors) return validationFailed(res, errors);

    const user = await User.findOne({ email: value.email });
    if (!user) return fail(res, ...OTP_ERRORS.invalid);

    const outcome = await otpService.verifyOtp(user._id, "reset_password", value.code);
    if (outcome !== "ok") return fail(res, ...OTP_ERRORS[outcome]);

    user.passwordHash = await bcrypt.hash(value.newPassword, BCRYPT_ROUNDS);
    // Receiving the code proves the person owns the email.
    if (user.emailVerified === false) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
    }
    await user.save();
    await tokenService.revokeAllForUser(user._id);

    return res.status(200).json({ data: { message: "Password updated. Sign in with your new password" } });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/auth/me
const getCurrentUser = async (req, res, next) => {
  try {
    // req.auth is populated by requireAuth after verifying the Bearer token.
    const user = await User.findById(req.auth.userId);
    if (!user) {
      return fail(res, 401, "UNAUTHENTICATED", "The account for this token no longer exists");
    }
    return res.status(200).json({ data: { user: publicUser(user) } });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
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
};
