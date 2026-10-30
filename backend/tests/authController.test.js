const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../models/userModel");
const otpService = require("../services/otpService");
const tokenService = require("../services/tokenService");
const {
  register,
  login,
  verifyEmail,
  forgotPassword,
  refresh,
} = require("../controllers/authController");

const mockResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  end() {
    return this;
  },
});

const fail = (error) => { throw error; };

// Swap object methods for the duration of one test.
const stub = (pairs) => {
  const originals = pairs.map(([obj, key]) => [obj, key, obj[key]]);
  pairs.forEach(([obj, key, fn]) => { obj[key] = fn; });
  return () => originals.forEach(([obj, key, fn]) => { obj[key] = fn; });
};

test("registration creates an unverified user, emails a code and returns no token", async () => {
  let emailedPurpose;
  const restore = stub([
    [bcrypt, "hash", async () => "test-password-hash"],
    [User, "create", async (data) => ({ ...data, _id: new mongoose.Types.ObjectId(), role: "user" })],
    [otpService, "issueOtp", async (user, purpose) => { emailedPurpose = purpose; return { sent: true }; }],
  ]);

  try {
    const res = mockResponse();
    await register({ body: { name: "Test User", email: "Test@Example.com", password: "password123" } }, res, fail);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.user.email, "test@example.com");
    assert.equal(res.body.data.user.role, "user");
    assert.equal(res.body.data.user.emailVerified, false);
    assert.equal(res.body.data.verification.required, true);
    assert.equal(res.body.data.verification.emailSent, true);
    assert.equal("accessToken" in res.body.data, false);
    assert.equal("passwordHash" in res.body.data.user, false);
    assert.equal(emailedPurpose, "verify_email");
  } finally {
    restore();
  }
});

test("registration rejects weak passwords with field details", async () => {
  const res = mockResponse();
  await register({ body: { name: "Test User", email: "test@example.com", password: "onlyletters" } }, res, fail);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
  assert.ok(res.body.error.details.password);
});

test("login refuses an unverified account with EMAIL_NOT_VERIFIED", async () => {
  const restore = stub([
    [User, "findOne", async () => ({ _id: new mongoose.Types.ObjectId(), passwordHash: "x", emailVerified: false })],
    [bcrypt, "compare", async () => true],
  ]);
  try {
    const res = mockResponse();
    await login({ body: { email: "a@b.co", password: "password123" }, get: () => "" }, res, fail);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, "EMAIL_NOT_VERIFIED");
  } finally {
    restore();
  }
});

test("login treats accounts created before verification existed as verified", async () => {
  const user = { _id: new mongoose.Types.ObjectId(), name: "Old", email: "old@b.co", role: "user", passwordHash: "x" };
  const restore = stub([
    [User, "findOne", async () => user],
    [bcrypt, "compare", async () => true],
    [tokenService, "issueTokens", async () => ({ accessToken: "a", refreshToken: "r" })],
  ]);
  try {
    const res = mockResponse();
    await login({ body: { email: "old@b.co", password: "password123" }, get: () => "" }, res, fail);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.accessToken, "a");
    assert.equal(res.body.data.refreshToken, "r");
  } finally {
    restore();
  }
});

test("a wrong verification code is rejected", async () => {
  const restore = stub([
    [User, "findOne", async () => ({ _id: new mongoose.Types.ObjectId(), emailVerified: false })],
    [otpService, "verifyOtp", async () => "invalid"],
  ]);
  try {
    const res = mockResponse();
    await verifyEmail({ body: { email: "a@b.co", code: "123456" }, get: () => "" }, res, fail);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "INVALID_CODE");
  } finally {
    restore();
  }
});

test("forgot-password answers the same for an unknown email", async () => {
  const restore = stub([[User, "findOne", async () => null]]);
  try {
    const res = mockResponse();
    await forgotPassword({ body: { email: "nobody@b.co" } }, res, fail);
    assert.equal(res.statusCode, 200);
    assert.match(res.body.data.message, /If an account exists/);
  } finally {
    restore();
  }
});

test("a reused or unknown refresh token is refused", async () => {
  const restore = stub([[tokenService, "consumeRefreshToken", async () => ({ error: "reused" })]]);
  try {
    const res = mockResponse();
    await refresh({ body: { refreshToken: "abc" }, get: () => "" }, res, fail);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, "INVALID_REFRESH_TOKEN");
  } finally {
    restore();
  }
});

const googleAuth = require("../services/googleAuth");
const { googleSignIn } = require("../controllers/authController");

test("Google sign-in creates a verified account for a new email", async () => {
  let created;
  const restore = stub([
    [googleAuth, "googleConfigured", () => true],
    [googleAuth, "verifyGoogleIdToken", async () => ({ googleId: "g-1", email: "new@gmail.com", emailVerified: true, name: "New Person" })],
    [User, "findOne", async () => null],
    [User, "create", async (data) => { created = data; return { ...data, _id: new mongoose.Types.ObjectId(), role: "user" }; }],
    [tokenService, "issueTokens", async () => ({ accessToken: "a", refreshToken: "r" })],
  ]);
  try {
    const res = mockResponse();
    await googleSignIn({ body: { idToken: "token" }, get: () => "" }, res, fail);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.isNewUser, true);
    assert.equal(created.emailVerified, true);
    assert.equal(created.googleId, "g-1");
    assert.equal("passwordHash" in created, false);
  } finally {
    restore();
  }
});

test("Google sign-in links an existing email account and verifies it", async () => {
  let saved = false;
  const existing = {
    _id: new mongoose.Types.ObjectId(), name: "Old", email: "old@gmail.com", role: "user", emailVerified: false,
    isModified: () => true, save: async () => { saved = true; },
  };
  const restore = stub([
    [googleAuth, "googleConfigured", () => true],
    [googleAuth, "verifyGoogleIdToken", async () => ({ googleId: "g-2", email: "old@gmail.com", emailVerified: true, name: "Old" })],
    [User, "findOne", async (q) => (q.email ? existing : null)],
    [tokenService, "issueTokens", async () => ({ accessToken: "a", refreshToken: "r" })],
  ]);
  try {
    const res = mockResponse();
    await googleSignIn({ body: { idToken: "token" }, get: () => "" }, res, fail);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.isNewUser, false);
    assert.equal(existing.googleId, "g-2");
    assert.equal(existing.emailVerified, true);
    assert.equal(saved, true);
  } finally {
    restore();
  }
});

test("Google sign-in rejects a token Google does not accept", async () => {
  const restore = stub([
    [googleAuth, "googleConfigured", () => true],
    [googleAuth, "verifyGoogleIdToken", async () => { throw new Error("bad"); }],
  ]);
  try {
    const res = mockResponse();
    await googleSignIn({ body: { idToken: "token" }, get: () => "" }, res, fail);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, "INVALID_GOOGLE_TOKEN");
  } finally {
    restore();
  }
});

test("Google sign-in answers 503 when GOOGLE_CLIENT_ID is missing", async () => {
  const restore = stub([[googleAuth, "googleConfigured", () => false]]);
  try {
    const res = mockResponse();
    await googleSignIn({ body: { idToken: "token" }, get: () => "" }, res, fail);
    assert.equal(res.statusCode, 503);
  } finally {
    restore();
  }
});

test("password login refuses a Google-only account without crashing", async () => {
  const restore = stub([[User, "findOne", async () => ({ _id: new mongoose.Types.ObjectId(), googleId: "g" })]]);
  try {
    const res = mockResponse();
    await login({ body: { email: "g@gmail.com", password: "password123" }, get: () => "" }, res, fail);
    assert.equal(res.statusCode, 401);
  } finally {
    restore();
  }
});
