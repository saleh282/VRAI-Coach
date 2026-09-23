const mongoose = require("mongoose");

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
      type: String,
      required: true,
    },

    role: {
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
