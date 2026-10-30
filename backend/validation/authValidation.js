// Input rules shared by the auth endpoints. Each validator returns
// { value, errors } where errors maps a field name to a message.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;

const isString = (v) => typeof v === "string";

const checkName = (name, errors) => {
  if (!isString(name) || !name.trim()) errors.name = "Name is required";
  else if (name.trim().length < 2 || name.trim().length > 60) errors.name = "Name must be 2 to 60 characters";
  return isString(name) ? name.trim().replace(/\s+/g, " ") : name;
};

const checkEmail = (email, errors) => {
  const normalized = isString(email) ? email.trim().toLowerCase() : "";
  if (!normalized) errors.email = "Email is required";
  else if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) errors.email = "Enter a valid email address";
  return normalized;
};

const checkPassword = (password, errors, field = "password") => {
  if (!isString(password) || !password) {
    errors[field] = "Password is required";
  } else if (password.length < 8) {
    errors[field] = "Password must be at least 8 characters";
  } else if (Buffer.byteLength(password, "utf8") > 72) {
    errors[field] = "Password must be at most 72 bytes";
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors[field] = "Password must contain at least one letter and one number";
  }
  return password;
};

const checkCode = (code, errors) => {
  const normalized = isString(code) ? code.trim() : "";
  if (!CODE_PATTERN.test(normalized)) errors.code = "Enter the 6-digit code";
  return normalized;
};

const result = (value, errors) => ({ value, errors: Object.keys(errors).length ? errors : null });

const validateRegister = (body = {}) => {
  const errors = {};
  return result({
    name: checkName(body.name, errors),
    email: checkEmail(body.email, errors),
    password: checkPassword(body.password, errors),
  }, errors);
};

const validateLogin = (body = {}) => {
  const errors = {};
  const email = checkEmail(body.email, errors);
  // Login only checks presence: old passwords may predate the current rules.
  if (!isString(body.password) || !body.password) errors.password = "Password is required";
  return result({ email, password: body.password }, errors);
};

const validateEmailOnly = (body = {}) => {
  const errors = {};
  return result({ email: checkEmail(body.email, errors) }, errors);
};

const validateEmailCode = (body = {}) => {
  const errors = {};
  return result({ email: checkEmail(body.email, errors), code: checkCode(body.code, errors) }, errors);
};

const validateResetPassword = (body = {}) => {
  const errors = {};
  return result({
    email: checkEmail(body.email, errors),
    code: checkCode(body.code, errors),
    newPassword: checkPassword(body.newPassword, errors, "newPassword"),
  }, errors);
};

const validateRefreshToken = (body = {}) => {
  const errors = {};
  const token = isString(body.refreshToken) ? body.refreshToken.trim() : "";
  if (!token || token.length > 200) errors.refreshToken = "refreshToken is required";
  return result({ refreshToken: token }, errors);
};

const validateGoogle = (body = {}) => {
  const errors = {};
  const idToken = isString(body.idToken) ? body.idToken.trim() : "";
  if (!idToken || idToken.length > 4096) errors.idToken = "idToken is required";
  return result({ idToken }, errors);
};

module.exports = {
  validateGoogle,
  validateRegister,
  validateLogin,
  validateEmailOnly,
  validateEmailCode,
  validateResetPassword,
  validateRefreshToken,
};
