const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

const User = require("../../models/userModel.js");
const Session = require("../../models/sessionModel.js");
const Evaluation = require("../../models/evaluationModel.js");

// Integration scripts load the shared .env from the repository root.
dotenv.config({ path: path.resolve(__dirname, "../../..", ".env"), quiet: true });

// Create sample records to manually smoke-test the three database models.
const testDatabase = async () => {
  try {
    // Connect to the configured development/test database.
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    // 1. Create a sample owner for the session.
    const user = await User.create({
      name: "Test User",
      email: "test@example.com",
      passwordHash: "hashed-password-example",
    });

    console.log("User created:");
    console.log(user);

    // 2. Create a completed sample session linked to that user.
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

    // 3. Create a submitted AI evaluation; the model calculates its total score.
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
    // Always release the database connection, even if a sample insert fails.
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};


testDatabase();
