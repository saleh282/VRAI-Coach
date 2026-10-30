const mongoose = require("mongoose");

// One-time codes sent by email. Only a hash of the code is stored.
const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userModel",
      required: true,
    },

    purpose: {
      // verify_email: confirm a new account. reset_password: forgot-password flow.
      type: String,
      enum: ["verify_email", "reset_password"],
      required: true,
    },

    codeHash: {
      type: String,
      required: true,
    },

    attempts: {
      // Wrong guesses so far; the code is burned after OTP_MAX_ATTEMPTS.
      type: Number,
      default: 0,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "otps",
  }
);

// Only one active code per user and purpose.
otpSchema.index({ userId: 1, purpose: 1 }, { unique: true });
// MongoDB deletes expired codes automatically.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("otpModel", otpSchema);
