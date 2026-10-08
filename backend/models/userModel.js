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
      type: String,
      required: true,
    },

    role: {
      // Public registration defaults to "user"; privileged roles are assigned internally.
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

module.exports = mongoose.model("userModel", userSchema);
