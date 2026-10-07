const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const User = require("../models/userModel");
const Session = require("../models/sessionModel");
const Evaluation = require("../models/evaluationModel");

test("keeps the existing Mongoose model names", () => {
  assert.equal(User.modelName, "userModel");
  assert.equal(Session.modelName, "sessionModel");
  assert.equal(Evaluation.modelName, "evaluationModel");
});

test("uses explicit collection names", () => {
  assert.equal(User.collection.collectionName, "users");
  assert.equal(Session.collection.collectionName, "sessions");
  assert.equal(Evaluation.collection.collectionName, "evaluations");
});

test("stores references for all session media files", async () => {
  const session = new Session({
    userId: new mongoose.Types.ObjectId(),
    category: "tech",
    difficulty: "medium",
    audioRef: "sessions/session-123/audio.wav",
    videoRef: "sessions/session-123/screen.mp4",
    motionRef: "sessions/session-123/motion.json",
  });

  await session.validate();

  assert.equal(session.audioRef, "sessions/session-123/audio.wav");
  assert.equal(session.videoRef, "sessions/session-123/screen.mp4");
  assert.equal(session.motionRef, "sessions/session-123/motion.json");
});

test("accepts user, rater, and admin roles", async () => {
  for (const role of ["user", "rater", "admin"]) {
    const user = new User({
      name: "Test User",
      email: `${role}@example.com`,
      passwordHash: "hash",
      role,
    });

    await user.validate();
  }
});

test("rejects an unsupported user role", async () => {
  const user = new User({
    name: "Test User",
    email: "invalid@example.com",
    passwordHash: "hash",
    role: "owner",
  });

  await assert.rejects(user.validate(), /role/);
});

test("allows a partial human evaluation draft", async () => {
  const evaluation = new Evaluation({
    sessionId: new mongoose.Types.ObjectId(),
    evaluatorType: "HUMAN",
    raterId: new mongoose.Types.ObjectId(),
    status: "DRAFT",
    scores: { communication: 80 },
  });

  await evaluation.validate();
  assert.equal(evaluation.overallScore, undefined);
});

test("calculates the weighted overall score", async () => {
  const evaluation = new Evaluation({
    sessionId: new mongoose.Types.ObjectId(),
    evaluatorType: "AI",
    modelVersion: "test-model-1",
    rubricVersion: "1.0.0",
    status: "SUBMITTED",
    scores: {
      communication: 82,
      clarity: 88,
      confidence: 75,
      contentQuality: 80,
    },
  });

  await evaluation.validate();

  assert.equal(evaluation.overallScore, 81.6);
  assert.ok(evaluation.submittedAt instanceof Date);
});

test("requires all scores before submission", async () => {
  const evaluation = new Evaluation({
    sessionId: new mongoose.Types.ObjectId(),
    evaluatorType: "AI",
    modelVersion: "test-model-1",
    status: "SUBMITTED",
    scores: { communication: 80 },
  });

  await assert.rejects(evaluation.validate(), /All rubric scores/);
});

test("requires evidence for a submitted human evaluation", async () => {
  const evaluation = new Evaluation({
    sessionId: new mongoose.Types.ObjectId(),
    evaluatorType: "HUMAN",
    raterId: new mongoose.Types.ObjectId(),
    status: "SUBMITTED",
    scores: {
      communication: 80,
      clarity: 80,
      confidence: 80,
      contentQuality: 80,
    },
  });

  await assert.rejects(evaluation.validate(), /evidenceNote/);
});
