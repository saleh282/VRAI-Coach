const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../models/userModel");
const { register } = require("../controllers/authController");

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
});

test("registration returns the created user without an access token", async () => {
  const originalHash = bcrypt.hash;
  const originalCreate = User.create;
  bcrypt.hash = async () => "test-password-hash";
  User.create = async (data) => ({
    ...data,
    _id: new mongoose.Types.ObjectId(),
    role: data.role || "user",
  });

  try {
    const res = mockResponse();
    await register(
      {
        body: {
          name: "Test User",
          email: "test@example.com",
          password: "password123",
        },
      },
      res,
      (error) => { throw error; }
    );

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.user.email, "test@example.com");
    assert.equal(res.body.data.user.role, "user");
    assert.equal("accessToken" in res.body.data, false);
    assert.equal("passwordHash" in res.body.data.user, false);
  } finally {
    bcrypt.hash = originalHash;
    User.create = originalCreate;
  }
});
