const crypto = require("crypto");
const Otp = require("../models/otpModel");
const mailer = require("./mailer");

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES) || 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

// Hash with the server secret so a leaked database does not reveal codes.
const hashCode = (code) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET || "dev").update(code).digest("hex");

const generateCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

// Create (or replace) the user's code for this purpose and email it.
// Returns { sent: false, retryAfterSec } when a code was sent less than a minute ago.
const issueOtp = async (user, purpose) => {
  const existing = await Otp.findOne({ userId: user._id, purpose }).lean();
  if (existing) {
    const ageSec = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
    if (ageSec < OTP_RESEND_SECONDS) {
      return { sent: false, retryAfterSec: Math.ceil(OTP_RESEND_SECONDS - ageSec) };
    }
  }

  const code = generateCode();
  await Otp.findOneAndUpdate(
    { userId: user._id, purpose },
    {
      $set: {
        codeHash: hashCode(code),
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
        createdAt: new Date(),
      },
    },
    { upsert: true, timestamps: false }
  );

  await mailer.sendOtpEmail({
    to: user.email,
    name: user.name,
    code,
    purpose,
    expiresInMinutes: OTP_TTL_MINUTES,
  });

  return { sent: true, expiresInSec: OTP_TTL_MINUTES * 60 };
};

// Check a code. On success the code is deleted so it cannot be reused.
// Returns "ok" | "invalid" | "expired" | "too_many_attempts".
const verifyOtp = async (userId, purpose, code) => {
  const otp = await Otp.findOne({ userId, purpose });
  if (!otp) return "invalid";
  if (otp.expiresAt.getTime() <= Date.now()) {
    await otp.deleteOne();
    return "expired";
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await otp.deleteOne();
    return "too_many_attempts";
  }

  const expected = Buffer.from(otp.codeHash, "hex");
  const given = Buffer.from(hashCode(code), "hex");
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    otp.attempts += 1;
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await otp.deleteOne();
      return "too_many_attempts";
    }
    await otp.save();
    return "invalid";
  }

  await otp.deleteOne();
  return "ok";
};

module.exports = { issueOtp, verifyOtp, OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS };
