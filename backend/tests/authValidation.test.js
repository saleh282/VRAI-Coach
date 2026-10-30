const test = require("node:test");
const assert = require("node:assert/strict");
const v = require("../validation/authValidation");

test("register: normalizes email and name", () => {
  const { value, errors } = v.validateRegister({ name: "  Saleh   Mohamed ", email: " Saleh@Example.COM ", password: "abc12345" });
  assert.equal(errors, null);
  assert.equal(value.email, "saleh@example.com");
  assert.equal(value.name, "Saleh Mohamed");
});

test("register: reports every bad field", () => {
  const { errors } = v.validateRegister({ name: "S", email: "not-an-email", password: "short" });
  assert.deepEqual(Object.keys(errors).sort(), ["email", "name", "password"]);
});

test("password needs a letter and a number and fits bcrypt's 72 bytes", () => {
  assert.ok(v.validateRegister({ name: "Ab", email: "a@b.co", password: "12345678" }).errors.password);
  assert.ok(v.validateRegister({ name: "Ab", email: "a@b.co", password: "abcdefgh" }).errors.password);
  assert.ok(v.validateRegister({ name: "Ab", email: "a@b.co", password: `a1${"é".repeat(40)}` }).errors.password);
  assert.equal(v.validateRegister({ name: "Ab", email: "a@b.co", password: "abcdefg1" }).errors, null);
});

test("codes must be exactly six digits", () => {
  assert.ok(v.validateEmailCode({ email: "a@b.co", code: "12345" }).errors.code);
  assert.ok(v.validateEmailCode({ email: "a@b.co", code: "12a456" }).errors.code);
  assert.equal(v.validateEmailCode({ email: "a@b.co", code: " 123456 " }).errors, null);
});

test("reset-password validates the new password", () => {
  const { errors } = v.validateResetPassword({ email: "a@b.co", code: "123456", newPassword: "weak" });
  assert.ok(errors.newPassword);
});

test("refresh token is required", () => {
  assert.ok(v.validateRefreshToken({}).errors.refreshToken);
});
