const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Session = require("../models/sessionModel");
const Evaluation = require("../models/evaluationModel");
const {
  getMySessions,
  getMySessionDetails,
} = require("../controllers/sessionController");

const query = (value) => ({
  select() { return this; },
  sort() { return this; },
  lean() { return Promise.resolve(value); },
});

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

test("lists only the signed-in user's sessions with AI result readiness", async () => {
  const originalFindSessions = Session.find;
  const originalFindEvaluations = Evaluation.find;
  const userId = new mongoose.Types.ObjectId().toString();
  const firstSessionId = new mongoose.Types.ObjectId();
  const secondSessionId = new mongoose.Types.ObjectId();
  let sessionFilter;
  let evaluationFilter;

  Session.find = (filter) => {
    sessionFilter = filter;
    return query([
      { _id: firstSessionId, category: "tech", difficulty: "medium", status: "completed" },
      { _id: secondSessionId, category: "soft_skills", difficulty: "easy", status: "pending" },
    ]);
  };
  Evaluation.find = (filter) => {
    evaluationFilter = filter;
    return query([{ sessionId: firstSessionId, submittedAt: new Date() }]);
  };

  try {
    const res = mockResponse();
    await getMySessions({ auth: { userId } }, res, (error) => { throw error; });

    assert.deepEqual(sessionFilter, { userId });
    assert.equal(evaluationFilter.evaluatorType, "AI");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.sessions.length, 2);
    assert.equal(res.body.data.sessions[0].resultStatus, "ready");
    assert.equal(res.body.data.sessions[1].resultStatus, "pending");
  } finally {
    Session.find = originalFindSessions;
    Evaluation.find = originalFindEvaluations;
  }
});

test("returns one owned session with its submitted AI result", async () => {
  const originalFindSession = Session.findOne;
  const originalFindEvaluation = Evaluation.findOne;
  const userId = new mongoose.Types.ObjectId().toString();
  const sessionId = new mongoose.Types.ObjectId();
  let sessionFilter;
  let evaluationFilter;

  Session.findOne = (filter) => {
    sessionFilter = filter;
    return query({
      _id: sessionId,
      category: "tech",
      difficulty: "medium",
      status: "completed",
    });
  };
  Evaluation.findOne = (filter) => {
    evaluationFilter = filter;
    return query({
      scores: { communication: 80, clarity: 85, confidence: 75, contentQuality: 90 },
      overallScore: 82.5,
      feedback: "Clear and structured answer",
      evaluatorType: "AI",
    });
  };

  try {
    const res = mockResponse();
    await getMySessionDetails(
      { auth: { userId }, params: { sessionId: sessionId.toString() } },
      res,
      (error) => { throw error; }
    );

    assert.deepEqual(sessionFilter, { _id: sessionId.toString(), userId });
    assert.deepEqual(evaluationFilter, {
      sessionId,
      evaluatorType: "AI",
      status: "SUBMITTED",
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.result.status, "ready");
    assert.equal(res.body.data.result.overallScore, 82.5);
    assert.equal("raterId" in res.body.data.result, false);
  } finally {
    Session.findOne = originalFindSession;
    Evaluation.findOne = originalFindEvaluation;
  }
});

test("returns 404 when the session is missing or belongs to another user", async () => {
  const originalFindSession = Session.findOne;
  const originalFindEvaluation = Evaluation.findOne;
  let queriedEvaluation = false;

  Session.findOne = () => query(null);
  Evaluation.findOne = () => {
    queriedEvaluation = true;
    return query(null);
  };

  try {
    const res = mockResponse();
    await getMySessionDetails(
      {
        auth: { userId: new mongoose.Types.ObjectId().toString() },
        params: { sessionId: new mongoose.Types.ObjectId().toString() },
      },
      res,
      (error) => { throw error; }
    );

    assert.equal(res.statusCode, 404);
    assert.equal(queriedEvaluation, false);
  } finally {
    Session.findOne = originalFindSession;
    Evaluation.findOne = originalFindEvaluation;
  }
});
