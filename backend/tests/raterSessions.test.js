const test = require("node:test");
const assert = require("node:assert/strict");

const Session = require("../models/sessionModel");
const Evaluation = require("../models/evaluationModel");
const { getRaterSessions } = require("../controllers/raterController");

const query = (value) => ({
  sort() { return this; },
  select() { return this; },
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

test("rater session list defaults to completed sessions only", async () => {
  const originalFindSessions = Session.find;
  const originalFindEvaluations = Evaluation.find;
  let sessionFilter;
  Session.find = (filter) => {
    sessionFilter = filter;
    return query([
      { _id: "completed-id", status: "completed" },
    ]);
  };
  Evaluation.find = () => query([]);

  try {
    const res = mockResponse();
    await getRaterSessions({ query: {} }, res);

    assert.deepEqual(sessionFilter, { status: "completed" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sessions.length, 1);
    assert.equal(res.body.sessions[0].status, "completed");
  } finally {
    Session.find = originalFindSessions;
    Evaluation.find = originalFindEvaluations;
  }
});
