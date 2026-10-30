const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/refreshTokenModel");

const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS) || 30;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const createAccessToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from the environment");
  }

  // Short-lived; the client uses its refresh token to get a new one.
  return jwt.sign({ role: user.role }, process.env.JWT_SECRET, {
    subject: user._id.toString(),
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
};

// A random opaque token; only its SHA-256 hash is stored.
const createRefreshToken = async (user, userAgent) => {
  const token = crypto.randomBytes(48).toString("base64url");
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    userAgent: userAgent ? String(userAgent).slice(0, 300) : undefined,
  });
  return token;
};

const issueTokens = async (user, userAgent) => ({
  accessToken: createAccessToken(user),
  refreshToken: await createRefreshToken(user, userAgent),
});

// Exchange a refresh token for a new pair (rotation).
// Returns { userId } of the token owner, or { error } when it cannot be used.
const consumeRefreshToken = async (token) => {
  const record = await RefreshToken.findOne({ tokenHash: hashToken(token) });
  if (!record || record.expiresAt.getTime() <= Date.now()) {
    return { error: "invalid" };
  }

  if (record.revokedAt) {
    // A revoked token being used again suggests it was stolen: sign the user out everywhere.
    await revokeAllForUser(record.userId);
    return { error: "reused" };
  }

  record.revokedAt = new Date();
  await record.save();
  return { userId: record.userId };
};

const revokeRefreshToken = async (token) => {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(token), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
};

const revokeAllForUser = async (userId) => {
  await RefreshToken.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
};

module.exports = {
  createAccessToken,
  issueTokens,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  REFRESH_TOKEN_DAYS,
};
