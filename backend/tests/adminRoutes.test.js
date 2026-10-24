const test = require("node:test");
const assert = require("node:assert/strict");
const adminRouter = require("../routes/adminRoutes");

const endpoints = [
  ["GET", "/users"],
  ["GET", "/users/:userId"],
  ["PATCH", "/users/:userId/role"],
  ["GET", "/sessions"],
  ["GET", "/sessions/:sessionId"],
  ["GET", "/raters"],
  ["GET", "/raters/:raterId"],
];

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("every admin endpoint is behind authentication and the admin-role gate", () => {
  const stack = adminRouter.stack;
  const guardLayers = stack
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer }) => !layer.route);
  const routeLayers = stack.filter((layer) => layer.route);

  assert.equal(routeLayers.length, endpoints.length);
  assert.equal(guardLayers.length, 2);
  assert.equal(guardLayers[0].layer.handle.name, "requireAuth");
  assert.ok(stack.findIndex((layer) => layer.route) > guardLayers[1].index);

  for (const [method, path] of endpoints) {
    const route = routeLayers.find((layer) =>
      layer.route.path === path && layer.route.methods[method.toLowerCase()]
    );
    assert.ok(route, `${method} ${path} should be registered`);
  }
});

test("admin role gate allows admin and rejects user and rater on every admin endpoint", () => {
  const roleGate = adminRouter.stack.filter((layer) => !layer.route)[1]?.handle;

  assert.ok(roleGate, "admin role middleware should be installed");

  for (const [method, path] of endpoints) {
    for (const role of ["user", "rater", "admin"]) {
      const req = { auth: { userId: "test-user", role }, method, path };
      const res = makeResponse();
      let proceeded = false;
      roleGate(req, res, () => { proceeded = true; });

      if (role === "admin") {
        assert.equal(proceeded, true, `${role} should access ${method} ${path}`);
      } else {
        assert.equal(proceeded, false, `${role} should not access ${method} ${path}`);
        assert.equal(res.statusCode, 403);
      }
    }
  }
});
