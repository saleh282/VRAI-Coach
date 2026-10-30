const mongoose = require("mongoose");

// Account data shared by the mobile app and trusted internal users.
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      // Store only the bcrypt hash; never store a plaintext password.
      // Accounts created with Google have no password until they set one with forgot-password.
      type: String,
      required: function () {
        return !this.googleId;
      },
    },

    googleId: {
      // Google's stable user id ("sub" in the ID token), set on first Google sign-in.
      type: String,
    },

    emailVerified: {
      // Registration sets this to false; the account can sign in once it is true.
      // No default on purpose: Mongoose would apply it to accounts created before
      // this field existed and lock them out. Those accounts count as verified.
      type: Boolean,
    },

    emailVerifiedAt: {
      type: Date,
    },

    role: {
      // Public registration creates a normal user; privileged roles are assigned internally.
      type: String,
      enum: ["user", "rater", "admin"],
      default: "user",
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

userSchema.index({ role: 1 });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("userModel", userSchema);
