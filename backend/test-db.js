const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

const User = require("./models/userModel");
const Session = require("./models/sessionModel");
const Evaluation = require("./models/evaluationModel");

dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const testDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    // -------------------------
    // 1. Create User
    // -------------------------

    const user = await User.create({
      name: "Test User",
      email: "test@example.com",
      passwordHash: "hashed-password-example",
    });

    console.log("User created:");
    console.log(user);

    // -------------------------
    // 2. Create Session
    // -------------------------

    const session = await Session.create({
      userId: user._id,
      sessionType: "interview",
      category: "soft_skills",
      difficulty: "medium",
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
    });

    console.log("Session created:");
    console.log(session);

    // -------------------------
    // 3. Create Evaluation
    // -------------------------

    const evaluation = await Evaluation.create({
      sessionId: session._id,
      evaluatorType: "AI",
      modelVersion: "interview-evaluator-test",
      rubricVersion: "1.0.0",
      status: "SUBMITTED",
      scores: {
        communication: 85,
        clarity: 90,
        confidence: 80,
        contentQuality: 85,
      },
      feedback: "Good performance in the interview.",
    });

    console.log("Evaluation created:");
    console.log(evaluation);

    console.log("Database test completed successfully!");

  } catch (error) {
    console.error("Database test failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

testDatabase();
