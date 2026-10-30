const mongoose = require("mongoose");

// Long-lived refresh tokens. The client keeps the random token; we keep its hash.
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userModel",
      required: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      // Set on logout, on rotation, and when the password changes.
      type: Date,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  {
    timestamps: true,
    collection: "refreshTokens",
  }
);

refreshTokenSchema.index({ userId: 1 });
// MongoDB deletes tokens once they expire.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("refreshTokenModel", refreshTokenSchema);
