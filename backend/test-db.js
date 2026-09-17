const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("./models/userModel");
const Session = require("./models/sessionModel");
const Evaluation = require("./models/evaluationModel");

dotenv.config({ path: "./config/config.env" });

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
      type: "AI",
      scores: {
        communication: 85,
        confidence: 80,
        clarity: 90,
      },
      overallScore: 85,
      feedback: "Good performance in the interview.",
    });

    console.log("Evaluation created:");
    console.log(evaluation);

    console.log("Database test completed successfully!");

  } catch (error) {
    console.error("Database test failed:");
    console.error(error.message);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

testDatabase();