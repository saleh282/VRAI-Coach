const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const User = require("../models/userModel");
const { getUserDetails } = require("../controllers/adminController");

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

test("admin user details return safe profile fields only", async () => {
  const originalFindById = User.findById;
  const userId = new mongoose.Types.ObjectId();
  let selectedFields;

  User.findById = () => ({
    select(fields) {
      selectedFields = fields;
      return this;
    },
    lean: async () => ({
      _id: userId,
      name: "Rater One",
      email: "rater@example.com",
      role: "rater",
      passwordHash: "should-not-be-returned",
    }),
  });

  try {
    const res = mockResponse();
    await getUserDetails(
      { params: { userId: userId.toString() } },
      res,
      (error) => { throw error; }
    );

    assert.equal(res.statusCode, 200);
    assert.match(selectedFields, /name email role/);
    assert.equal(res.body.data.user.role, "rater");
    assert.equal("passwordHash" in res.body.data.user, false);
  } finally {
    User.findById = originalFindById;
  }
});

test("admin user details reject an invalid user ID", async () => {
  const originalFindById = User.findById;
  User.findById = () => {
    throw new Error("Database should not be queried for an invalid ID");
  };

  try {
    const res = mockResponse();
    await getUserDetails({ params: { userId: "not-an-id" } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "INVALID_USER_ID");
  } finally {
    User.findById = originalFindById;
  }
});
