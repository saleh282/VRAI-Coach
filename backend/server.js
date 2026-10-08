const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const raterRoutes = require("./routes/raterRoutes");
const sessionRoutes = require("./routes/sessionRoutes");

// Load the project-root environment file (one directory above backend/).
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const app = express();
// Parse JSON request bodies and reject oversized payloads early.
app.use(express.json({ limit: "10kb" }));

// Mount each feature's routes under its versioned API prefix.
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/sessions", sessionRoutes);
app.use("/api/v1/rater", raterRoutes);

app.get("/", (req, res) => {
    res.send("VRAI-Coach Backend is running 🚀");
});

app.get("/health", (req, res) => {
  // Report unavailable until the MongoDB connection is ready.
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

app.use((error, req, res, next) => {
  // Keep internal error details in server logs, not in public responses.
  console.error("Request failed:", error.message);
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Fail fast rather than starting an API that cannot sign or verify tokens.
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from the project .env file");
  }

  // Connect to the database before accepting HTTP requests.
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const shutdown = async () => {
    // Close the database connection cleanly when the process is stopped.
    console.log("Shutting down server...");
    await mongoose.connection.close();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
