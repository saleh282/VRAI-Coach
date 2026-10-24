const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Session = require("../models/sessionModel");
const Evaluation = require("../models/evaluationModel");
const { submitAiEvaluation } = require("../controllers/aiController");
const { requireAiServiceKey } = require("../middleware/aiServiceMiddleware");

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

const completedSessionQuery = (status = "completed") => ({
  select() {
    return Promise.resolve(status ? { status } : null);
  },
});

const evaluationQuery = (value) => ({
  select() {
    return Promise.resolve(value);
  },
});

const validRequest = (sessionId) => ({
  params: { sessionId: sessionId.toString() },
  body: {
    modelVersion: "model-1",
    rubricVersion: "1.0.0",
    scores: {
      communication: 80,
      clarity: 85,
      confidence: 75,
      contentQuality: 90,
    },
    feedback: "Clear and structured.",
  },
});

test("accepts a valid AI result and calculates its overall score", async () => {
  const originalFindById = Session.findById;
  const originalFindOne = Evaluation.findOne;
  const originalSave = Evaluation.prototype.save;
  const sessionId = new mongoose.Types.ObjectId();

  Session.findById = () => completedSessionQuery();
  Evaluation.findOne = () => evaluationQuery(null);
  Evaluation.prototype.save = async function saveForTest() {
    await this.validate();
    return this;
  };

  try {
    const res = mockResponse();
    await submitAiEvaluation(validRequest(sessionId), res, (error) => { throw error; });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.sessionId, sessionId.toString());
    assert.equal(res.body.data.evaluatorType, "AI");
    assert.equal(res.body.data.status, "SUBMITTED");
    assert.equal(res.body.data.overallScore, 82.75);
    assert.equal(res.body.data.modelVersion, "model-1");
  } finally {
    Session.findById = originalFindById;
    Evaluation.findOne = originalFindOne;
    Evaluation.prototype.save = originalSave;
  }
});

test("rejects an AI result for a session that is not completed", async () => {
  const originalFindById = Session.findById;
  const sessionId = new mongoose.Types.ObjectId();
  Session.findById = () => completedSessionQuery("pending");

  try {
    const res = mockResponse();
    await submitAiEvaluation(validRequest(sessionId), res, (error) => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, "SESSION_NOT_COMPLETED");
  } finally {
    Session.findById = originalFindById;
  }
});

test("rejects invalid AI scores before saving", async () => {
  const originalFindById = Session.findById;
  const sessionId = new mongoose.Types.ObjectId();
  Session.findById = () => completedSessionQuery();
  const req = validRequest(sessionId);
  req.body.scores.communication = 101;

  try {
    const res = mockResponse();
    await submitAiEvaluation(req, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "INVALID_SCORE");
  } finally {
    Session.findById = originalFindById;
  }
});

test("rejects a duplicate AI result for the same model and rubric", async () => {
  const originalFindById = Session.findById;
  const originalFindOne = Evaluation.findOne;
  const sessionId = new mongoose.Types.ObjectId();
  Session.findById = () => completedSessionQuery();
  Evaluation.findOne = () => evaluationQuery({ _id: new mongoose.Types.ObjectId() });

  try {
    const res = mockResponse();
    await submitAiEvaluation(validRequest(sessionId), res, (error) => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, "AI_EVALUATION_ALREADY_EXISTS");
  } finally {
    Session.findById = originalFindById;
    Evaluation.findOne = originalFindOne;
  }
});

test("requires the configured AI service key", () => {
  const previousKey = process.env.AI_SERVICE_API_KEY;
  process.env.AI_SERVICE_API_KEY = "test-secret-key";

  try {
    const res = mockResponse();
    let proceeded = false;
    requireAiServiceKey(
      { get: () => "wrong-secret" },
      res,
      () => { proceeded = true; }
    );
    assert.equal(res.statusCode, 401);
    assert.equal(proceeded, false);

    const successRes = mockResponse();
    requireAiServiceKey(
      { get: () => "test-secret-key" },
      successRes,
      () => { proceeded = true; }
    );
    assert.equal(proceeded, true);
  } finally {
    if (previousKey === undefined) delete process.env.AI_SERVICE_API_KEY;
    else process.env.AI_SERVICE_API_KEY = previousKey;
  }
});
