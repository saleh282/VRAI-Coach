const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client();

// Client IDs allowed to sign in: web, Android and iOS, comma-separated.
const allowedClientIds = () =>
  (process.env.GOOGLE_CLIENT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

const googleConfigured = () => allowedClientIds().length > 0;

// Check a Google ID token's signature, expiry and audience.
// Returns { googleId, email, emailVerified, name } or throws.
const verifyGoogleIdToken = async (idToken) => {
  const ticket = await client.verifyIdToken({ idToken, audience: allowedClientIds() });
  const payload = ticket.getPayload();
  return {
    googleId: payload.sub,
    email: (payload.email || "").toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name || payload.given_name || (payload.email || "").split("@")[0],
  };
};

module.exports = { verifyGoogleIdToken, googleConfigured };
